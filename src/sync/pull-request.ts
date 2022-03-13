import { PullRequestSort, PullRequestState, SortDirection } from "../github/client/types";
import url from "url";
import transformPullRequest from "./transforms/pull-request";
import statsd from "../config/statsd";
import { GitHubAPI } from "probot";
import { metricHttpRequest } from "../config/metric-names";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { getGithubUser } from "../services/github/user";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { AxiosResponseHeaders } from "axios";
import { Octokit } from "@octokit/rest";

/**
 * Find the next page number from the response headers.
 */
export const getNextPage = (logger: LoggerWithTarget, headers: Headers = {}): number | undefined => {
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

type PullRequestWithCursor = { cursor: number } & Octokit.PullsListResponseItem;

export default async function(
	logger: LoggerWithTarget,
	github: GitHubAPI,
	newGithub: GitHubClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | number = 1,
	perPage?: number
) {
	logger.info("Syncing PRs: started");

	const useNewGHClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT__FOR_PR, false, jiraHost);
	cursor = Number(cursor);
	const startTime = Date.now();

	const vars = {
		owner: repository.owner.login,
		repo: repository.name,
		per_page: perPage,
		page: cursor
	};

	const {
		data: edges,
		status,
		headers
	} = useNewGHClient ?
		await newGithub
			.getPullRequests(repository.owner.login, repository.name,
				{
					per_page: perPage,
					page: cursor,
					state: PullRequestState.ALL,
					sort: PullRequestSort.CREATED,
					direction: SortDirection.DES
				})
		: await github.pulls.list({ ...vars, state: "all", sort: "created", direction: "desc" });

	statsd.timing(metricHttpRequest.syncPullRequest, Date.now() - startTime, 1, [`status:${status}`]);

	// Force us to go to a non-existant page if we're past the max number of pages
	const nextPage = getNextPage(logger, headers) || cursor + 1;

	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edgesWithCursor: PullRequestWithCursor[] = edges.map((edge) => ({ ...edge, cursor: nextPage }));

	// TODO: change this to reduce
	const pullRequests = (
		await Promise.all(
			edgesWithCursor.map(async (pull) => {
				const prResponse = useNewGHClient ? (await newGithub.getPullRequest(repository.owner.login, repository.name, pull.number)) :
					(await github?.pulls?.get({
						owner: repository.owner.login, repo: repository.name, pull_number: pull.number
					}));
				const prDetails = prResponse?.data
				const ghUser = await getGithubUser(
					useNewGHClient ? newGithub : github,
					prDetails?.user.login
				);
				const data = await transformPullRequest(
					{ pullRequest: pull, repository },
					prDetails,
					ghUser
				);
				return data?.pullRequests[0];
			})
		)
	).filter((value) => !!value);

	logger.info("Syncing PRs: finished");

	return {
		edges: edgesWithCursor,
		jiraPayload:
			pullRequests?.length
				? {
					id: repository.id,
					name: repository.full_name,
					pullRequests,
					url: repository.html_url,
					updateSequenceId: Date.now()
				}
				: undefined
	};
}
