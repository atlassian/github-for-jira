import url from "url";
import {
	transformPullRequest
} from "../transforms/transform-pull-request";
import { statsd } from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { AxiosResponseHeaders } from "axios";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { shouldSendAll } from "config/feature-flags";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { createHashWithSharedSecret } from "utils/encryption";

/**
 * Find the next page number from the response headers.
 */
export const getNextPage = (logger: Logger, headers: Headers = {}): number | undefined => {
	const nextUrl = ((headers.link || "").match(/<([^>]+)>;\s*rel="next"/) ||
		[])[1];
	if (!nextUrl) {
		return undefined;
	}
	logger.debug("Extracting next PRs page url");
	const parsed = url.parse(nextUrl)?.query?.split("&");
	let nextPage;
	parsed?.forEach((query) => {
		const [key, value] = query.split("=");
		if (key === "page") {
			nextPage = Number(value);
		}
	});
	return nextPage;
};

type Headers = AxiosResponseHeaders & {
	link?: string;
}

export const getPullRequestTask = async (
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	return getPullRequestTaskGraphQL(logger, gitHubInstallationClient, jiraHost, repository, messagePayload, cursor as string, perPage);
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

const getPullRequestTaskGraphQL = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	messagePayload: BackfillMessagePayload,
	cursor?: string,
	perPage?: number
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
