import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { Repository } from "models/subscription";
import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { statsd } from "config/statsd";
import { metricPrReviewers } from "config/metric-names";

export const 	getPullRequestReviews = async (
	jiraHost: string,
	gitHubInstallationClient: GitHubInstallationClient,
	repository: Repository,
	pullRequest: Octokit.PullsListResponseItem,
	logger: Logger
): Promise<Array<{ state?: string, user: Octokit.PullsUpdateResponseRequestedReviewersItem }>> =>
{
	const { owner: { login: repositoryOwner }, name: repositoryName, id: repositoryId } = repository;
	const { number: pullRequestNumber, id: pullRequestId } = pullRequest;

	try {
		const requestedReviewsResponse = await gitHubInstallationClient.getPullRequestRequestedReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const requestedReviewsData = requestedReviewsResponse.data;

		statsd.incrementWithValue(metricPrReviewers.requestedReviewsCount, requestedReviewsData.users.length, {}, { jiraHost });
		statsd.histogram(metricPrReviewers.requestedReviewsHist, requestedReviewsData.users.length, {}, { jiraHost });

		const submittedReviewsResponse = await gitHubInstallationClient.getPullRequestReviews(repositoryOwner, repositoryName, pullRequestNumber);
		const submittedReviewsData = submittedReviewsResponse.data;

		statsd.incrementWithValue(metricPrReviewers.submittedReviewsCount, submittedReviewsData.length, {}, { jiraHost });
		statsd.histogram(metricPrReviewers.submittedReviewsHist, submittedReviewsData.length, {}, { jiraHost });

		return requestedReviewsData.users.map(user => ({ user })).concat(submittedReviewsData);
	} catch (err: unknown) {
		statsd.increment(metricPrReviewers.failedCount, {}, { jiraHost });
		logger.warn({ pullRequestNumber, pullRequestId, repositoryId },"Get Pull Reviews Failed - Check Github Permissions: Can't retrieve reviewers");
		return [];
	}
};
