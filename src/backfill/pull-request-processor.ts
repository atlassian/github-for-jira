import { RateLimitState, StepProcessor, StepResult } from "./looper/api";
import { JobState } from "./index";
import GitHubClient from "../github/client/github-client";
import { PullRequestSort, PullRequestState, SortDirection } from "../github/client/types";
import { AxiosResponse } from "axios";
import { Octokit } from "@octokit/rest";
import { toRateLimitState } from "./rate-limit-mapper";
import transformPullRequest from "../sync/transforms/pull-request";
import getJiraClient from "../jira/client";
import { getLogger } from "../config/logger";

export class PullRequestProcessor implements StepProcessor<JobState> {

	async process(jobState: JobState, _?: RateLimitState): Promise<StepResult<JobState>> {

		let rateLimitState: RateLimitState | undefined = undefined;

		if (jobState.repositoryState.pullStatus == "complete") {
			return PullRequestProcessor.success(jobState);
		}

		const nextPage = jobState.repositoryState.lastPullCursor || 1;

		const githubClient = new GitHubClient(jobState.installationId);

		const pullrequestsResponse: AxiosResponse<Octokit.PullsListResponseItem[]> = await githubClient.getPullRequests(
			jobState.repository.owner.login,
			jobState.repository.name, {
				per_page: 20,
				page: nextPage,
				state: PullRequestState.ALL,
				sort: PullRequestSort.CREATED,
				direction: SortDirection.DES
			});

		rateLimitState = toRateLimitState(pullrequestsResponse);
		const pullrequests = pullrequestsResponse.data;

		if (!pullrequests.length) {
			return PullRequestProcessor.success(jobState, rateLimitState);
		}

		// TODO: the following GitHub calls should ideally update the rate limit state
		const transformedPullrequests = pullrequests
			.map(async (pullrequest) => {
				const pullrequestDetails = await PullRequestProcessor.mapToPullrequestDetails(githubClient, pullrequest, jobState.repository.owner.login, jobState.repository.name);
				const githubUser = await githubClient.getUserByUsername(pullrequestDetails.user.login);
				const transformedPullrequest = await transformPullRequest(
					{ pullRequest: pullrequest, repository: jobState.repository },
					pullrequestDetails,
					githubUser
				);
				return transformedPullrequest?.pullRequests[0];
			});

		const jiraClient = await getJiraClient(
			jobState.jiraHost,
			jobState.installationId,
			getLogger("pullrequest-processor")
		);

		if (transformedPullrequests.length) {
			await jiraClient.devinfo.repository.update({
				id: jobState.repository.id,
				name: jobState.repository.full_name,
				pullRequests: transformedPullrequests,
				url: jobState.repository.html_url,
				updateSequenceId: Date.now()
			}, {
				preventTransitions: true
			});
		}

		jobState.repositoryState.lastPullCursor = nextPage + 1;

		return PullRequestProcessor.success(jobState, rateLimitState);
	}

	/**
	 * Maps a pullrequest list item to a pull request item with all the details by calling out to GitHub.
	 */
	private static async mapToPullrequestDetails(githubClient: GitHubClient, pullRequestListItem: Octokit.PullsListResponseItem, owner: string, repo: string): Promise<Octokit.PullsGetResponse> {
		const response = await githubClient.getPullRequest(
			owner,
			repo,
			pullRequestListItem.number.toString());
		return response.data;
	}

	private static success(jobState: JobState, rateLimitState?: RateLimitState): StepResult<JobState> {
		return {
			jobState: jobState,
			rateLimit: rateLimitState
		};
	}

}
