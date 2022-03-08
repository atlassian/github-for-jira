import { transformPullRequest } from "../transforms/pull-request";
import issueKeyParser from "jira-issue-key-parser";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { isEmpty } from "lodash";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import GitHubClient from "./client/github-client";
import { getCloudInstallationId } from "./client/installation-id";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";

export const pullRequestWebhookHandler = async (
	context: CustomContext,
	jiraClient,
	util,
	githubInstallationId: number
): Promise<void> => {
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner }
		},
		changes
	} = context.payload;

	const githubClient =
		await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_PUSH_WEBHOOK, false, jiraClient.baseURL) ?
			new GitHubClient(getCloudInstallationId(githubInstallationId), context.log)
			: context.github;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await getReviews(githubClient, owner, repo, pull_request.number);
	} catch (e) {
		context.log.warn(
			{
				err: e,
				payload: context.payload,
				pull_request
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = await transformPullRequest(
		githubClient,
		pull_request,
		reviews,
		context.log
	);

	const { number: pullRequestNumber, body: pullRequestBody, id: pullRequestId } = pull_request;
	const logPayload = { pullRequestId, pullRequestNumber, jiraPayload };

	context.log.info(logPayload, "Pullrequest mapped to Jira Payload");

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = issueKeyParser().parse(changes?.title?.from);

		if (!isEmpty(issueKeys)) {
			context.log.info(
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
			context.log(logPayload, "Updating pull request");
			updateGitHubIssues(githubClient, linkifiedBody, pull_request.id, context)
		}
	} catch (err) {
		context.log.warn(
			{ err, body: pullRequestBody, pullRequestNumber },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	if (!jiraPayload) {
		context.log.info(
			{ pullRequestNumber, pullRequestId },
			"Halting futher execution for pull request since jiraPayload is empty"
		);
		return;
	}

	const baseUrl = jiraClient.baseUrl || "none";

	context.log(logPayload, `Sending pull request update to Jira ${baseUrl}`);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};

const updateGitHubIssues = async (githubCient: GitHubAPI | GitHubClient, body, context, id) => {
	const editedPullRequest = context.issue({
		body,
		id
	});

	const {owner, repo, issue_number} = editedPullRequest;
	githubCient instanceof GitHubClient ?
		await githubCient.updateIssue(editedPullRequest, owner, repo, issue_number) :
		await context.github.issues.update(editedPullRequest);
}

const getReviews = async (githubCient: GitHubAPI | GitHubClient, owner: string, repo: string, pull_number: number): Promise<Octokit.PullsListReviewsResponse> => {
	const response = githubCient instanceof GitHubClient ?
		await githubCient.getPullRequestReviews(owner, repo, pull_number) :
		await githubCient.pulls.listReviews({ owner, repo, pull_number });
	return response.data;
};

