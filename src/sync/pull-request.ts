import { transformPullRequest } from "../transforms/transform-pull-request";
import { statsd } from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { booleanFlag, BooleanFlags, shouldSendAll } from "config/feature-flags";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { createHashWithSharedSecret } from "utils/encryption";

export const getPullRequestTask = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	const logger = parentLogger.child({ backfillTask: "PullRequest" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const createdSince = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;

	const response = await gitHubInstallationClient.getPullRequestPage(repository.owner.login, repository.name, perPage, cursor);

	const filteredByCreatedSince = response.repository?.pullRequests?.edges
		.filter(pull => !createdSince || pull.node.createdAt > createdSince.toISOString());
	const alwaysSend = await shouldSendAll("prs-backfill", jiraHost, logger);
	const pullRequests = filteredByCreatedSince
		?.map((edge) => transformPullRequest(repository, jiraHost, edge.node, alwaysSend, logger))
		?.filter((pr) => pr !== undefined) || [];

	(logger.fields || {}).prNumberArray = pullRequests.map(pull => createHashWithSharedSecret(String(pull?.id)));
	logger.info({ processingTime: Date.now() - startTime, pullRequestsLength: pullRequests?.length || 0 }, "Backfill task complete");

	emitStats(jiraHost, startTime, "GRAPHQL");

	if (pullRequests.length === 0) {
		return {
			edges: filteredByCreatedSince || [],
			jiraPayload: undefined
		};
	}

	const jiraPayload = {
		...transformRepositoryDevInfoBulk(repository, gitHubInstallationClient.baseUrl),
		pullRequests
	};

	return {
		edges: filteredByCreatedSince || [],
		jiraPayload
	};

};

const emitStats = (jiraHost: string, startTime: number, requestType: string) => {
	statsd.timing(
		metricHttpRequest.syncPullRequest,
		Date.now() - startTime,
		1,
		{ requestType },
		{ jiraHost }
	);
};
