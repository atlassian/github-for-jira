import { transformPullRequest } from "../transforms/transform-pull-request";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { isEmpty } from "lodash";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { getCloudInstallationId } from "./client/installation-id";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { JiraPullRequestData } from '../interfaces/jira';
import { jiraIssueKeyParser } from "utils/jira-utils";
import { GitHubIssueData } from '../interfaces/github';
import {getGitHubBaseUrl} from "utils/check-github-app-type";
import {gheServerAuthAndConnectFlowFlag} from "utils/feature-flag-utils";

export const pullRequestWebhookHandler = async (context: CustomContext, jiraClient, util, githubInstallationId: number): Promise<void> => {
	const {
		pull_request,
		repository: {
			id: repositoryId,
			name: repoName,
			owner: { login: owner }
		},
		changes
	} = context.payload;
	const { number: pullRequestNumber, id: pullRequestId } = pull_request;
	const baseUrl = jiraClient.baseUrl || "none";
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);
	const githubClient = await gheServerAuthAndConnectFlowFlag(jiraHost) ?
		new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubBaseUrl), context.log, gitHubBaseUrl) :
		new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), context.log);

	context.log = context.log.child({
		jiraHostName: jiraClient.baseURL,
		installationId: githubInstallationId,
		pullRequestNumber,
		pullRequestId
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let reviews: any = {};
	try {
		reviews = await getReviews(githubClient, owner, repoName, pull_request.number);
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

	const jiraPayload: JiraPullRequestData | undefined = await transformPullRequest(githubClient, pull_request, reviews, context.log);

	context.log.info("Pullrequest mapped to Jira Payload");

	// Deletes PR link to jira if ticket id is removed from PR title
	if (!jiraPayload && changes?.title) {
		const issueKeys = jiraIssueKeyParser(changes?.title?.from);

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
		await updateGithubIssues(githubClient, context, util, repoName, owner, pull_request);
	} catch (err) {
		context.log.warn(
			{ err },
			"Error while trying to update PR body with links to Jira ticket"
		);
	}

	if (!jiraPayload) {
		context.log.info("Halting futher execution for pull request since jiraPayload is empty");
		return;
	}

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

const updateGithubIssues = async (github: GitHubInstallationClient | GitHubAPI, context: CustomContext, util, repoName, owner, pullRequest) => {
	const linkifiedBody = await util.unfurl(pullRequest.body);

	if (!linkifiedBody) {
		return;
	}

	context.log("Updating pull request");

	const updatedPullRequest: GitHubIssueData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		issue_number: pullRequest.number
	};

	github instanceof GitHubInstallationClient ?
		await github.updateIssue(updatedPullRequest) :
		await github.issues.update(updatedPullRequest);
};

const getReviews = async (githubCient: GitHubInstallationClient, owner: string, repo: string, pull_number: number): Promise<Octokit.PullsListReviewsResponse> => {
	const response = await githubCient.getPullRequestReviews(owner, repo, pull_number);
	return response.data;
};
