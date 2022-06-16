import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { GitHubIssue, GitHubIssueCommentData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { IssueCommentEvent } from "@octokit/webhooks-types";
import { WebhookContext } from "../routes/github/webhook/webhook-context";

export const issueCommentWebhookHandler = async (
	context: CustomContext,
	jiraClient: any,
	util: any,
	githubInstallationId: number
): Promise<void> => {
	return await issueCommentWebhookHandler_new(context as WebhookContext, jiraClient, util, githubInstallationId);
};

export const issueCommentWebhookHandler_new = async (
	{ name, log, webhookReceived, payload }: WebhookContext,
	jiraClient: any,
	util: any,
	githubInstallationId: number
): Promise<void> => {
	const {
		comment,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = (payload as IssueCommentEvent);
	let linkifiedBody = "";

	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraClient.baseURL, log);

	// TODO: need to create reusable function for unfurling
	try {
		linkifiedBody = await util.unfurl(comment.body);
		if (!linkifiedBody) {
			log.debug("Halting further execution for issueComment since linkifiedBody is empty");
			return;
		}
	} catch (err) {
		log.warn(
			{ err, linkifiedBody, body: comment.body },
			"Error while trying to find Jira keys in comment body"
		);
	}

	log(`Updating comment in GitHub with ID ${comment.id}`);
	const updatedIssueComment: GitHubIssueCommentData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		comment_id: comment.id
	};

	const githubResponse: GitHubIssue = await gitHubInstallationClient.updateIssueComment(updatedIssueComment);

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};
