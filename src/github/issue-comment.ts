import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { GitHubIssue, GitHubIssueCommentData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "../routes/github/webhook/webhook-context";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { getJiraClient } from "~/src/jira/client/jira-client";

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

	await syncIssueCommentsToJira(jiraClient.baseURL, context, gitHubInstallationClient);

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

	context.log.info(`Updating comment in GitHub with ID ${comment.id}`);
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

const syncIssueCommentsToJira = async (jiraHost: string, context: WebhookContext, gitHubInstallationClient: GitHubInstallationClient) => {
	const { comment, repository, issue } = context.payload;
	const { body: gitHubMessage, id: gitHubId } = comment;
	const pullRequest = await gitHubInstallationClient.getPullRequest(repository.owner.login, repository.name, issue.number);
	const issueKey = jiraIssueKeyParser(pullRequest.data.head.ref)[0] || "";
	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationClient.githubInstallationId.installationId,
		context.gitHubAppConfig?.gitHubAppId,
		context.log
	);

	// TODO: Need to figure out a way to get this comment id
	// Hard coding for now
	const commentId = 10003;
	switch (context.action) {
		case "created": {
			const comment = await jiraClient.issues.comments.addForIssue(issueKey, {
				body: gitHubMessage,
				// Adding custom Property
				properties: [
					{
						key: "id",
						value:  {
							value1: "GH-" + gitHubId
						}
					}
				]
			});
			context.log.debug("New one ", comment.data);
			break;
		}
		case "edited": {
			await jiraClient.issues.comments.updateForIssue(issueKey, commentId, { body: gitHubMessage });
			break;
		}
		case "deleted":
			await jiraClient.issues.comments.deleteForIssue(issueKey, commentId);
			break;
		default:
			context.log.error("This shouldn't happen", context);
			break;
	}
};
