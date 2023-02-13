import { createInstallationClient } from "utils/get-github-client-config";
import { Octokit } from "@octokit/rest";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { SQSMessageContext } from "~/src/sqs/sqs.types";
import { SqsQueue } from "~/src/sqs/sqs";
import Logger from "bunyan";

const ALLOWED_QUEUES = ["backfill"];

// Fetch the rate limit from GitHub API and check if the usages has exceeded the preemptive threshold
export const preemptiveRateLimitCheck = async (context: SQSMessageContext<any>, sqsQueue: SqsQueue<any>) : Promise<boolean> => {
	if (!ALLOWED_QUEUES.includes(sqsQueue.queueName))
	{
		return false;
	}

	const { jiraHost } = context.payload;
	const threshold = await numberFlag(NumberFlags.PREEMPTIVE_RATE_LIMIT_THRESHOLD, 100, jiraHost);

	try {
		const rateLimitResponse = (await getRateRateLimitStatus(context)).data;
		const { core, graphql } = rateLimitResponse.resources;
		const usedPercentCore = ((core.limit - core.remaining) / core.limit) * 100;
		const usedPercentGraphql = ((graphql.limit - graphql.remaining) / graphql.limit) * 100;
		if (usedPercentCore >= threshold || usedPercentGraphql >= threshold) {
			// Delay the message until rate limit has reset
			await sqsQueue.changeVisibilityTimeout(context.message, getRateResetTime(rateLimitResponse, context.log), context.log);
			return true;
		}
	} catch (err) {
		context.log.error({ err }, "Failed to fetch Rate Limit");
	}

	return false;
};

const getRateRateLimitStatus = async (context: SQSMessageContext<any>) => {
	const { installationId, jiraHost } = context.payload;
	const gitHubAppId = context.payload.gitHubAppConfig?.gitHubAppId;
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, gitHubAppId);
	return await gitHubInstallationClient.getRateLimit();
};

const getRateResetTime = (rateLimitResponse: Octokit.RateLimitGetResponse, log: Logger): number => {
	// Get the furthest away rate reset to ensure we don't exhaust the other one too quickly
	const resetEpochDateTime = Math.max(rateLimitResponse?.resources?.core?.reset, rateLimitResponse?.resources?.graphql?.reset);
	// Get the difference in seconds between now and reset time
	const timeToResetInSeconds = resetEpochDateTime - (Date.now()/1000);
	log.info({ timeToResetInSeconds }, "Preemptive rate limit reset time");
	return timeToResetInSeconds;
};
