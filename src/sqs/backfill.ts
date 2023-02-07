import { processInstallation } from "../sync/installation";
import * as Sentry from "@sentry/node";
import { AxiosErrorEventDecorator } from "models/axios-error-event-decorator";
import { SentryScopeProxy } from "models/sentry-scope-proxy";
import { BackfillMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { createInstallationClient } from "utils/get-github-client-config";
import { sqsQueues } from "~/src/sqs/queues";
import Logger from "bunyan";
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
		gitHubInstallationId: installationId
	});

	const backfillData = { ...context.payload };
	const rateLimitResponse = (await getRateRateLimitStatus(backfillData, context.log))?.data;

	// Check if the rate limit is exceeding self-imposed limit
	if (await isRateLimitExceedingSoftLimit(rateLimitResponse, jiraHost)) {
		context.log.info("Rate limit internal threshold exceeded, delaying backfilling message.");
		return await sqsQueues.backfill.changeVisibilityTimeout(context.message, getRateResetTime(rateLimitResponse), context.log);
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

const getRateRateLimitStatus = async (backfillData: BackfillMessagePayload, logger: Logger) => {
	const { installationId, jiraHost } = backfillData;
	const gitHubAppId = backfillData.gitHubAppConfig?.gitHubAppId;
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, logger, gitHubAppId);

	return await gitHubInstallationClient.getRateLimit();
};

const isRateLimitExceedingSoftLimit = async (rateLimitResponse: Octokit.RateLimitGetResponse, jiraHost) : Promise<boolean> => {
	const threshold = await numberFlag(NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD, 100, jiraHost);
	const { core, graphql } = rateLimitResponse.resources;
	const usedPercentCore = ((core.limit - core.remaining) / core.limit) * 100;
	const usedPercentGraphql = ((graphql.limit - graphql.remaining) / graphql.limit) * 100;

	return usedPercentCore >= threshold || usedPercentGraphql >= threshold;
};

const getRateResetTime = (rateLimitResponse: Octokit.RateLimitGetResponse): number => {
	// Get the furthest away rate reset to ensure we don't exhaust the other one too quickly
	return Math.max(rateLimitResponse?.resources?.core?.reset, rateLimitResponse?.resources?.graphql?.reset);
};
