import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { GitHubIssue, GitHubIssueCommentData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const issueCommentWebhookHandler = async (
	context: WebhookContext,
	jiraClient,
	util,
	gitHubInstallationId: number
): Promise<void> => {
	const {
		comment,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;

	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost: jiraClient.baseURL
	});

	let linkifiedBody;
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraClient.baseURL, context.log, gitHubAppId);

	// TODO: need to create reusable function for unfurling
	try {
		linkifiedBody = await util.unfurl(comment.body);
		if (!linkifiedBody) {
			context.log.debug("Halting further execution for issueComment since linkifiedBody is empty");
			return;
		}
	} catch (err) {
		context.log.warn(
			{ err, linkifiedBody, body: comment.body },
			"Error while trying to find Jira keys in comment body"
		);
	}

	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	context.log.info({ commentId: comment.id, gitHubProduct }, "Updating issue comment in GitHub.");
	const updatedIssueComment: GitHubIssueCommentData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		comment_id: comment.id
	};

	const githubResponse: GitHubIssue = await gitHubInstallationClient.updateIssueComment(updatedIssueComment);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status,
		gitHubAppId
	);
};
