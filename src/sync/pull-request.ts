import { PullRequestSort, PullRequestState, SortDirection } from "../github/client/github-client.types";
import url from "url";
import { extractIssueKeysFromPr, transformPullRequest } from "../transforms/transform-pull-request";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { AxiosResponseHeaders } from "axios";
import { Octokit } from "@octokit/rest";
import { getCloudOrServerFromHost } from "utils/get-cloud-or-server";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { getPullRequestReviews } from "~/src/transforms/util/github-get-pull-request-reviews";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { isEmpty } from "lodash";
import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";

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
	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);
	const numberOfPagesToFetchInParallel = await numberFlag(NumberFlags.NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL, 0, jiraHost);
	if (!numberOfPagesToFetchInParallel || numberOfPagesToFetchInParallel <= 1) {
		return doGetPullRequestTask(logger, gitHubInstallationClient, jiraHost, repository, smartCursor, messagePayload);
	} else {
		return doGetPullRequestTaskInParallel(numberOfPagesToFetchInParallel, logger, gitHubInstallationClient, jiraHost, repository, smartCursor, messagePayload);
	}
};

const doGetPullRequestTaskInParallel = (
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
		doGetPullRequestTask(
			logger, gitHubInstallationClient, jiraHost, repository,
			pageCursor,
			messagePayload
		)
);

const doGetPullRequestTask = async (
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
	statsd.timing(
		metricHttpRequest.syncPullRequest,
		Date.now() - startTime,
		1,
		{ status: String(status), gitHubProduct },
		{ jiraHost }
	);

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

	// TODO: change this to reduce
	const pullRequests = (
		await Promise.all(
			edgesWithCursor.map(async (pull) => {

				if (isEmpty(extractIssueKeysFromPr(pull))) {
					logger.info({
						prId: pull.id
					}, "Skip PR cause it has no issue keys");
					return undefined;
				}

				const prResponse = await gitHubInstallationClient.getPullRequest(repository.owner.login, repository.name, pull.number);
				const prDetails = prResponse?.data;

				const	reviews = await getPullRequestReviews(jiraHost, gitHubInstallationClient, repository, pull, logger);
				const data = await transformPullRequest(gitHubInstallationClient, prDetails, reviews, logger);
				return data?.pullRequests[0];

			})
		)
	).filter((value) => !!value);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: pullRequests?.length }, "Backfill task complete");

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
