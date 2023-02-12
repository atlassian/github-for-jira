import { processInstallation } from "../sync/installation";
import * as Sentry from "@sentry/node";
import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { BackfillMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { createInstallationClient } from "utils/get-github-client-config";
import { sqsQueues } from "~/src/sqs/queues";
import { Octokit } from "@octokit/rest";
import { numberFlag, NumberFlags } from "config/feature-flags";

export const backfillQueueMessageHandler: MessageHandler<BackfillMessagePayload> = async (context: SQSMessageContext<BackfillMessagePayload>) => {
	const sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
	sentry.configureScope((scope) =>
		scope.addEventProcessor(AxiosErrorEventDecorator.decorate)
	);
	sentry.configureScope((scope) =>
		scope.addEventProcessor(SentryScopeProxy.processEvent)
	);

	const { installationId, jiraHost } = context.payload;
	context.log = context.log.child({
		jiraHost,
		gitHubInstallationId: installationId,
		traceId: Date.now()
	});

	const backfillData = { ...context.payload };

	// Check if the rate limit is exceeding self-imposed limit
	if (await isRateLimitExceedingSoftLimit(context)) {
		context.log.info("Rate limit internal threshold exceeded, delaying backfilling message.");
		return;
	}

	if (!backfillData.startTime) {
		backfillData.startTime = new Date().toISOString();
	}

	try {
		const processor = await processInstallation();
		await processor(backfillData, sentry, context.log);
	} catch (err) {
		sentry.setExtra("job", {
			id: context.message.MessageId,
			attemptsMade: parseInt(context.message.Attributes?.ApproximateReceiveCount || "1"),
			timestamp: new Date(),
			data: context.payload
		});

		sentry.setTag("jiraHost", context.payload.jiraHost);
		sentry.setTag("queue", "sqs-backfill");
		sentry.captureException(err);

		throw err;
	}
};

const getRateRateLimitStatus = async (context: SQSMessageContext<BackfillMessagePayload>) => {
	const { installationId, jiraHost } = context.payload;
	const gitHubAppId = context.payload.gitHubAppConfig?.gitHubAppId;
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, gitHubAppId);

	return await gitHubInstallationClient.getRateLimit();
};

// Fetch the rate limit from GitHub API and check if the usages has exceeded the preemptive threshold
const isRateLimitExceedingSoftLimit = async (context: SQSMessageContext<BackfillMessagePayload>) : Promise<boolean> => {
	const { jiraHost } = context.payload;
	const threshold = await numberFlag(NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD, 100, jiraHost);

	try {
		const rateLimitResponse = (await getRateRateLimitStatus(context))?.data;
		const { core, graphql } = rateLimitResponse.resources;
		const usedPercentCore = ((core.limit - core.remaining) / core.limit) * 100;
		const usedPercentGraphql = ((graphql.limit - graphql.remaining) / graphql.limit) * 100;
		if (usedPercentCore >= threshold || usedPercentGraphql >= threshold) {
			// Delay the message until rate limit has reset
			await sqsQueues.backfill.changeVisibilityTimeout(context.message, getRateResetTime(rateLimitResponse), context.log);
			return true;
		}
	} catch {
		context.log.info("Failed to fetch Rate Limit");
	}

	return false;
};

const getRateResetTime = (rateLimitResponse: Octokit.RateLimitGetResponse): number => {
	// Get the furthest away rate reset to ensure we don't exhaust the other one too quickly
	return Math.max(rateLimitResponse?.resources?.core?.reset, rateLimitResponse?.resources?.graphql?.reset);
};
