import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { Repository } from "models/subscription";
import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import _ from "lodash";

export const 	getPullRequestReviews = async (
	gitHubInstallationClient: GitHubInstallationClient,
	repository: Repository,
	pullRequest: Octokit.PullsListResponseItem,
	logger: Logger
): Promise<Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }>> =>
{
	const { owner: { login: repositoryOwner }, name: repositoryName, id: repositoryId } = repository;
	const { number: pullRequestNumber, id: pullRequestId } = pullRequest;

	try {
		const responseReviewers = await gitHubInstallationClient.getPullRequestReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const reviewers = responseReviewers.data;

		const responseRequestedReviewers = await gitHubInstallationClient.getPullRequestRequestedReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const requestedReviewers = responseRequestedReviewers.data;

		const result: Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }> = _.cloneDeep(reviewers);
		requestedReviewers.users.forEach(user => {
			result.push({
				user
			});
		});
		return result;
	} catch (err) {
		logger.warn({ pullRequestNumber, pullRequestId, repositoryId },"Get Pull Reviews Failed - Check Github Permissions: Can't retrieve reviewers");
		return [];
	}
};
