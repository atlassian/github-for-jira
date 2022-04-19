import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import GitHubClient from "./client/github-client";
import { getCloudInstallationId } from "./client/installation-id";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { WebhookPayloadIssues } from "@octokit/webhooks";
import { GitHubIssue } from '../interfaces/github';

export const issueWebhookHandler = async (context: CustomContext<WebhookPayloadIssues>, jiraClient, util, githubInstallationId: number): Promise<void> => {
	const { issue, repository } = context.payload;
	const githubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_ISSUE_WEBHOOK, false, jiraClient.baseURL) ?
		new GitHubClient(getCloudInstallationId(githubInstallationId), context.log) :
		context.github;

	// TODO: need to create reusable function for unfurling
	let linkifiedBody;
	try {
		linkifiedBody = await util.unfurl(issue.body);
		if (!linkifiedBody) {
			context.log("Halting further execution for issue since linkifiedBody is empty");
			return;
		}
	} catch (err) {
		context.log.warn(
			{ err, linkifiedBody, body: issue.body },
			"Error while trying to find jira keys in issue body"
		);
	}

	context.log(`Updating issue in GitHub with issueId: ${issue.id}`);

	const webhookPayload = {
		body: linkifiedBody,
		owner: repository.owner.login,
		repo: repository.name,
		issue_number: issue.number
	}

	const githubResponse: GitHubIssue = await updateIssue(githubClient, webhookPayload);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};

const updateIssue = async (githubClient:GitHubAPI | GitHubClient, issue: Octokit.IssuesUpdateParams) =>
	githubClient instanceof GitHubClient ? await githubClient.updateIssue(issue) : await githubClient.issues.update(issue);
