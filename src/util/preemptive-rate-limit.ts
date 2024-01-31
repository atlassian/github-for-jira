import { createInstallationClient } from "utils/get-github-client-config";
import { Octokit } from "@octokit/rest";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { SQSMessageContext } from "~/src/sqs/sqs.types";
import { SqsQueue } from "~/src/sqs/sqs";
import type { BaseMessagePayload } from "~/src/sqs/sqs.types";

// List of queues we want to apply the preemptive rate limiting on
const TARGETED_QUEUES = ["backfill", "deployment"];
export const DEFAULT_PREEMPTY_RATELIMIT_DELAY_IN_SECONDS = 10 * 60; // 10 minutes

type PreemptyRateLimitCheckResult = {
	isExceedThreshold: boolean;
	resetTimeInSeconds?: number;
};

// Fetch the rate limit from GitHub API and check if the usages has exceeded the preemptive threshold
export const preemptiveRateLimitCheck = async <T extends BaseMessagePayload>(context: SQSMessageContext<T>, sqsQueue: SqsQueue<T>) : Promise<PreemptyRateLimitCheckResult> => {

	if (!TARGETED_QUEUES.includes(sqsQueue.queueName))
	{
		return { isExceedThreshold: false };
	}

	const { jiraHost } = context.payload;
	const threshold = await numberFlag(NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD, 100, jiraHost);

	try {
		const rateLimitResponse = (await getRateRateLimitStatus(context)).data;

		if (Math.random() < 0.05) {
			context.log.info({ rateLimitResponse }, "Rate limit check result (sampled)");
		}
		const { core, graphql } = rateLimitResponse.resources;
		const usedPercentCore = ((core.limit - core.remaining) / core.limit) * 100;
		const usedPercentGraphql = ((graphql.limit - graphql.remaining) / graphql.limit) * 100;
		if (usedPercentCore >= threshold || usedPercentGraphql >= threshold) {
			const resetTimeInSeconds = getRateResetTimeInSeconds(rateLimitResponse);
			context.log.info({ threshold, usedPercentCore, usedPercentGraphql, rateLimitResponse, resetTimeInSeconds }, `Rate limit check result: exceeded threshold`);
			return {
				isExceedThreshold: true,
				resetTimeInSeconds
			};
		}
	} catch (err: unknown) {
		context.log.error({ err, gitHubServerAppId: context.payload.gitHubAppConfig?.gitHubAppId }, "Failed to fetch Rate Limit");
	}

	return { isExceedThreshold: false };

};

const getRateRateLimitStatus = async (context: SQSMessageContext<BaseMessagePayload>) => {
	const { installationId, jiraHost } = context.payload;
	const gitHubAppId = context.payload.gitHubAppConfig?.gitHubAppId;
	const metrics = {
		trigger: "ratelimit_check"
	};
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, metrics, context.log, gitHubAppId);
	return await gitHubInstallationClient.getRateLimit();
};

const getRateResetTimeInSeconds = (rateLimitResponse: Octokit.RateLimitGetResponse): number => {
	// Get the furthest away rate reset to ensure we don't exhaust the other one too quickly
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const resetEpochDateTimeInSeconds = Math.max(rateLimitResponse?.resources?.core?.reset, rateLimitResponse?.resources?.graphql?.reset);
	const timeToResetInSeconds = resetEpochDateTimeInSeconds - (Date.now()/1000);
	//sometimes, possibly a bug in github?, the timeToResetInSeconds is almost 0. To avoid reschdule to task too soon, adding a minimum of 10 minutes.
	const finalTimeToRestInSeconds = Math.max(DEFAULT_PREEMPTY_RATELIMIT_DELAY_IN_SECONDS, timeToResetInSeconds);
	return finalTimeToRestInSeconds;
};
