import { PullRequestSort, PullRequestState, SortDirection } from "../github/client/github-client.types";
import url from "url";
import {
	extractIssueKeysFromPrRest,
	transformPullRequest,
	transformPullRequestRest
} from "../transforms/transform-pull-request";
import { statsd } from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { AxiosResponseHeaders } from "axios";
import { Octokit } from "@octokit/rest";
import { getCloudOrServerFromHost } from "utils/get-cloud-or-server";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { getPullRequestReviews } from "~/src/transforms/util/github-get-pull-request-reviews";
import { booleanFlag, BooleanFlags, numberFlag, NumberFlags, shouldSendAll } from "config/feature-flags";
import { isEmpty } from "lodash";
import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";
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

type PullRequestWithCursor = { cursor: string } & Octokit.PullsListResponseItem;

export const getPullRequestTask = async (
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	if (await booleanFlag(BooleanFlags.USE_NEW_PULL_ALGO, jiraHost)) {
		return getPullRequestTaskGraphQL(logger, gitHubInstallationClient, jiraHost, repository, messagePayload, cursor as string, perPage);
	}

	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);
	const numberOfPagesToFetchInParallel = await numberFlag(NumberFlags.NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL, 0, jiraHost);
	if (!numberOfPagesToFetchInParallel || numberOfPagesToFetchInParallel <= 1) {
		return getPullRequestTaskRest(logger, gitHubInstallationClient, jiraHost, repository, smartCursor, messagePayload);
	} else {
		return getPullRequestTaskInParallel(numberOfPagesToFetchInParallel, logger, gitHubInstallationClient, jiraHost, repository, smartCursor, messagePayload);
	}
};

const getPullRequestTaskInParallel = (
	numberOfPagesToFetchInParallel: number,
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	pageSizeAwareCursor: PageSizeAwareCounterCursor,
	messagePayload: BackfillMessagePayload
) => fetchNextPagesInParallel(
	numberOfPagesToFetchInParallel,
	pageSizeAwareCursor,
	(pageCursor) =>
		getPullRequestTaskRest(
			logger, gitHubInstallationClient, jiraHost, repository,
			pageCursor,
			messagePayload
		)
);

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

	const isDraftPrFfOn = await booleanFlag(BooleanFlags.INNO_DRAFT_PR);

	const filteredByCreatedSince = response.repository?.pullRequests?.edges
		.filter(pull => !createdSince || pull.node.createdAt > createdSince.toISOString());
	const alwaysSend = await shouldSendAll("prs-backfill", jiraHost, logger);
	const pullRequests = filteredByCreatedSince
		?.map((edge) => transformPullRequest(repository, jiraHost, edge.node, alwaysSend, logger, isDraftPrFfOn))
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

const getPullRequestTaskRest = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	pageSizeAwareCursor: PageSizeAwareCounterCursor,
	messagePayload: BackfillMessagePayload
) => {
	const logger = parentLogger.child({ backfillTask: "Pull" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const {
		data: edges,
		status,
		headers,
		request
	} =	await gitHubInstallationClient
		.getPullRequests(repository.owner.login, repository.name,
			{
				per_page: pageSizeAwareCursor.perPage	,
				page: pageSizeAwareCursor.pageNo,
				state: PullRequestState.ALL,
				sort: PullRequestSort.CREATED,
				direction: SortDirection.DES
			});

	const gitHubProduct = getCloudOrServerFromHost(request.host);

	// Force us to go to a non-existant page if we're past the max number of pages
	const nextPageNo = getNextPage(logger, headers) || (pageSizeAwareCursor.pageNo + 1);
	const nextPageCursorStr = pageSizeAwareCursor.copyWithPageNo(nextPageNo).serialise();

	//Rest api: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests
	//Because GitHub rest api  doesn't support supply a from date in the query param,
	//So we have to do a filter after we fetch the data and stop (via return []) once the date has passed.
	const fromDate = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	if (areAllEdgesEarlierThanFromDate(edges, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edgesWithCursor: PullRequestWithCursor[] = edges.map((edge) => ({ ...edge, cursor: nextPageCursorStr }));

	const pullRequests = (
		await Promise.all(
			edgesWithCursor.map(async (pull) => {

				if (isEmpty(await extractIssueKeysFromPrRest(pull, jiraHost))) {
					logger.info({
						prId: pull.id
					}, "Skip PR cause it has no issue keys");
					return undefined;
				}
				const prResponse = await gitHubInstallationClient.getPullRequest(repository.owner.login, repository.name, pull.number);
				const prDetails = prResponse?.data;

				const	reviews = await getPullRequestReviews(jiraHost, gitHubInstallationClient, repository, pull, logger);
				const data = await transformPullRequestRest(gitHubInstallationClient, prDetails, reviews, logger, jiraHost);
				return data?.pullRequests[0];

			})
		)
	).filter((value) => !!value);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: pullRequests?.length }, "Backfill task complete");

	statsd.timing(
		metricHttpRequest.syncPullRequest,
		Date.now() - startTime,
		1,
		{ status: String(status), gitHubProduct, requestType: "REST" },
		{ jiraHost }
	);

	return {

		edges: edgesWithCursor,
		jiraPayload:
			pullRequests?.length
				? {
					... transformRepositoryDevInfoBulk(repository, gitHubInstallationClient.baseUrl),
					pullRequests
				}
				: undefined
	};
};

const areAllEdgesEarlierThanFromDate = (edges: Octokit.PullsListResponseItem[], fromDate: Date | undefined): boolean => {

	if (!fromDate) return false;

	return edges.every(edge => {
		const edgeCreatedAt = new Date(edge.created_at);
		return edgeCreatedAt.getTime() < fromDate.getTime();
	});

};
