import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "middleware/github-webhook-middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { GitHubAppClient } from "./client/github-app-client";
import { getCloudInstallationId } from "./client/installation-id";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";

export const issueCommentWebhookHandler = async (
	context: CustomContext,
	jiraClient,
	util,
	githubInstallationId: number
): Promise<void> => {
	const { comment, repository } = context.payload;
	let linkifiedBody;

	const githubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_ISSUE_COMMENT_WEBHOOK, false, jiraClient.baseURL) ?
		new GitHubAppClient(getCloudInstallationId(githubInstallationId), context.log) :
		context.github;

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

	context.log(`Updating comment in GitHub with ID ${comment.id}`);

	const githubResponse = await updateIssueComment(githubClient, {
		body: linkifiedBody,
		owner: repository.owner.login,
		repo: repository.name,
		comment_id: comment.id
	});
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};

const updateIssueComment = async (githubClient: GitHubAPI | GitHubAppClient, comment: Octokit.IssuesUpdateCommentParams) =>
	githubClient instanceof GitHubAppClient ? await githubClient.updateIssueComment(comment) : await githubClient.issues.updateComment(comment);
