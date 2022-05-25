import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { getCloudInstallationId } from "./client/installation-id";
import { WebhookPayloadIssues } from "@octokit/webhooks";
import { GitHubIssue, GitHubIssueData } from "../interfaces/github";

export const issueWebhookHandler = async (context: CustomContext<WebhookPayloadIssues>, _jiraClient, util, githubInstallationId: number): Promise<void> => {
	const {
		issue,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;

	const githubClient = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), context.log);

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

	const updatedIssue: GitHubIssueData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		issue_number: issue.number
	}

	const githubResponse: GitHubIssue = await githubClient.updateIssue(updatedIssue);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};
