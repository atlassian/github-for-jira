import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { WebhookPayloadIssues } from "@octokit/webhooks";
import { GitHubIssue, GitHubIssueData } from 'interfaces/github';
import { createInstallationClient } from "~/src/util/get-github-client-config";

export const issueWebhookHandler = async (context: CustomContext<WebhookPayloadIssues>, _jiraClient, util, githubInstallationId: number): Promise<void> => {
	const {
		issue,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;

	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraHost, context.log);

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

	const githubResponse: GitHubIssue = await gitHubInstallationClient.updateIssue(updatedIssue);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};
