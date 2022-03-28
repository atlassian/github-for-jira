import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { GitHubAppClient } from "./client/github-app-client";
import { getCloudInstallationId } from "./client/installation-id";

export const issueCommentWebhookHandler = async (
	context: CustomContext,
	_jiraClient,
	util,
	githubInstallationId: number
): Promise<void> => {
	const { comment, repository } = context.payload;
	let linkifiedBody;

	const githubClient = new GitHubAppClient(getCloudInstallationId(githubInstallationId), context.log);

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
	const githubResponse = await githubClient.updateIssueComment({
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
