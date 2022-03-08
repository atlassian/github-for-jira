import { isEmpty } from "lodash";
import { transformPullRequest } from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { booleanFlag, BooleanFlags } from "src/config/feature-flags";
import GitHubClient from "./client/github-client";
import { getCloudInstallationId } from "./client/installation-id";

export const pullRequestWebhookHandler = async (context: CustomContext, jiraClient, util, githubInstallationId: number): Promise<void> => {

	const { webhookReceived, name, github, log: logger, payload } = context;
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner },
		},
		changes,
	} = payload;
	const useNewGithubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_PR_EVENTS, false, jiraClient.baseURL);
	const githubClient = new GitHubClient(getCloudInstallationId(githubInstallationId), logger);

	///////////
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = useNewGithubClient ? await githubClient.listPullRequestReviews(owner, repo, pull_request.number) :
			await github.pulls.listReviews({
				owner: owner,
				repo: repo,
				pull_number: pull_request.number,
			});
	} catch (e) {
		logger.warn(
			{
				err: e,
				payload,
				pull_request,
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = await transformPullRequest( github, pull_request, reviews.data, logger);
	const { number: pullRequestNumber, body: pullRequestBody, id: pullRequestId } = pull_request;
	const logPayload = { pullRequestId, pullRequestNumber, jiraPayload };

	logger.info(logPayload, "Pullrequest mapped to Jira Payload");

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = issueKeyParser().parse(changes?.title?.from);

		if (!isEmpty(issueKeys)) {
			logger.info(
				{ issueKeys },
				"Sending pullrequest delete event for issue keys"
			);

			await jiraClient.devinfo.pullRequest.delete(
				repositoryId,
				pullRequestNumber
			);

			return;
		}
	}

	try {
		const linkifiedBody = await util.unfurl(pullRequestBody);

		if (linkifiedBody) {
			const editedPullRequest = context.issue({
				body: linkifiedBody,
				id: pull_request.id,
			});
			logger(logPayload, "Updating pull request");

			// JOSH-TODO REPLACE GH HERE
			await github.issues.update(editedPullRequest);
		}
	} catch (err) {
		logger.warn(
			{ err, body: pullRequestBody, pullRequestNumber },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	if (!jiraPayload) {
		logger.info(
			{ pullRequestNumber, pullRequestId },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	const baseUrl = jiraClient.baseUrl || "none";

	logger(logPayload, `Sending pull request update to Jira ${baseUrl}`);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);

	if (webhookReceived) {
		emitWebhookProcessedMetrics(webhookReceived, name, logger, jiraResponse?.status);
	}
};
