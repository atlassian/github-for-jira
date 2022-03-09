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

export const pullRequestWebhookHandler = async (context: CustomContext, jiraClient, util, githubInstallationId: number): Promise<void> => {
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repo,
			owner: { login: owner }
		},
		changes
	} = context.payload;
	const { number: pullRequestNumber, body: pullRequestBody, id: pullRequestId } = pull_request;
	const baseUrl = jiraClient.baseUrl || "none";
	const githubClient =
		await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_PULL_REQUEST_WEBHOOK, false, jiraClient.baseURL) ?
			new GitHubClient(getCloudInstallationId(githubInstallationId), context.log)
			: context.github;

	context.log = context.log.child({
		number: pullRequestNumber,
		body: pullRequestBody,
		id: pullRequestId
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await getReviews(githubClient, owner, repo, pull_request.number);
	} catch (err) {
		context.log.warn(
			{
				err,
				payload: context.payload,
				pull_request
			},
			"Missing Github Permissions: Can't retrieve reviewers"
		);
	}

	const jiraPayload = await transformPullRequest(githubClient, pull_request, reviews, context.log);
	context.log.info("Pullrequest mapped to Jira Payload");

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
		await updateGithubIssues(githubClient, context, util, pull_request);
	} catch (err) {
		console.log("err ERROR ME");
		console.log(err);
		context.log.warn(
			{ err },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	console.log("webhookReceiveda");
	console.log(context.webhookReceived);
	if (!jiraPayload) {
		context.log.info("Halting futher execution for pull request since jiraPayload is empty");
		return;
	}

	console.log("is")
	console.log(githubClient instanceof GitHubClient)
	console.log("jiraPayload");
	console.log(jiraPayload);
	context.log(`Sending pull request update to Jira ${baseUrl}`);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};

const updateGithubIssues = async (github: GitHubClient | GitHubAPI, context: CustomContext, util, pullRequest) => {
	const linkifiedBody = await util.unfurl(pullRequest.body);
	if (!linkifiedBody) {
		return;
	}

	context.log("Updating pull request");
	const editedPullRequest = context.issue({
		body: linkifiedBody,
		id: pullRequest.id
	});

	console.log("isgithub")
	console.log(github instanceof GitHubClient)
	console.log("all good a");
	const { body, id, owner, repo, number } = editedPullRequest;
	console.log("all good b");
	console.log(body);
	console.log(id);
	console.log(owner);
	console.log(repo);
	console.log(number);
	console.log(editedPullRequest);

	// todo JOSH the issue is here somewhere with issue_number
	github instanceof GitHubClient ?
		await github.updateIssue({ body, id }, owner, repo, number) :
		await github.issues.update(editedPullRequest);
};

const getReviews = async (githubCient: GitHubAPI | GitHubClient, owner: string, repo: string, pull_number: number): Promise<Octokit.PullsListReviewsResponse> => {
	const response = githubCient instanceof GitHubClient ?
		await githubCient.getPullRequestReviews(owner, repo, pull_number) :
		await githubCient.pulls.listReviews({ owner, repo, pull_number });
	return response.data;
};