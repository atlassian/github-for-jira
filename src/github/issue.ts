import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import type { IssuesOpenedEvent, IssuesEditedEvent } from "@octokit/webhooks-types";
import { GitHubIssue, GitHubIssueData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "../routes/github/webhook/webhook-context";

export const issueWebhookHandler = async (context: WebhookContext<IssuesOpenedEvent | IssuesEditedEvent>, jiraClient, util, gitHubInstallationId: number): Promise<void> => {
	const {
		issue,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;

	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const metrics = {
		trigger: "webhook",
		subTrigger: "issue"
	};
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraClient.baseURL, metrics, context.log, gitHubAppId);

	// TODO: need to create reusable function for unfurling
	let linkifiedBody;
	try {
		if (issue.body !== null) {
			linkifiedBody = await util.unfurl(issue.body);
		}
		if (!linkifiedBody) {
			context.log.info("Halting further execution for issue since linkifiedBody is empty");
			return;
		}
	} catch (err: unknown) {
		context.log.warn(
			{ err, linkifiedBody, body: issue.body },
			"Error while trying to find jira keys in issue body"
		);
	}

	context.log.info(`Updating issue in GitHub with issueId: ${issue.id}`);

	const updatedIssue: GitHubIssueData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		issue_number: issue.number
	};

	const githubResponse: GitHubIssue = await gitHubInstallationClient.updateIssue(updatedIssue);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		jiraClient.jiraHost,
		log,
		githubResponse?.status,
		gitHubAppId
	);
};
