import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { Repository } from "models/subscription";
import { Octokit } from "@octokit/rest";
import Logger from "bunyan";

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
		const responseRequestedReviewers = await gitHubInstallationClient.getPullRequestRequestedReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const requestedReviewers = responseRequestedReviewers.data;

		const responseReviewers = await gitHubInstallationClient.getPullRequestReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const reviewers = responseReviewers.data;

		return requestedReviewers.users.map(user => ({ user })).concat(reviewers);
	} catch (err) {
		logger.warn({ pullRequestNumber, pullRequestId, repositoryId },"Get Pull Reviews Failed - Check Github Permissions: Can't retrieve reviewers");
		return [];
	}
};
