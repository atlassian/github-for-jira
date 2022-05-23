import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { getCloudInstallationId } from "./client/installation-id";
import { GitHubIssue, GitHubIssueCommentData } from "../interfaces/github";
import {getGitHubBaseUrl} from "utils/check-github-app-type";
import { gheServerAuthAndConnectFlowFlag } from "../util/feature-flag-utils";

export const issueCommentWebhookHandler = async (
	context: CustomContext,
	_jiraClient,
	util,
	githubInstallationId: number
): Promise<void> => {
	const {
		comment,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;
	let linkifiedBody;

	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);
	const githubClient = await gheServerAuthAndConnectFlowFlag(jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubBaseUrl), context.log, gitHubBaseUrl)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), context.log);

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
	const updatedIssueComment: GitHubIssueCommentData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		comment_id: comment.id
	}

	const githubResponse: GitHubIssue = await githubClient.updateIssueComment(updatedIssueComment);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};
