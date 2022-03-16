import { WebhookPayloadCreate } from "@octokit/webhooks";
import { Context, MessageHandler } from "./index";
import app from "../worker/app";
import { processBranch } from "../github/branch";
import { GitHubAppClient } from "../github/client/github-app-client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { getCloudInstallationId } from "../github/client/installation-id";

export type BranchMessagePayload = {
	jiraHost: string,
	installationId: number,
	webhookReceived: number,
	webhookId: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 9KB.
	webhookPayload: WebhookPayloadCreate,
}

export const branchQueueMessageHandler: MessageHandler<BranchMessagePayload> = async (context: Context<BranchMessagePayload>) => {

	context.log.info("Handling branch message from the SQS queue")

	const messagePayload: BranchMessagePayload = context.payload;
	const gitHubClient = new GitHubAppClient(getCloudInstallationId(messagePayload.installationId), context.log);
	const githubApi = await app.auth(messagePayload.installationId);
	const github = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCH_EVENT, false, messagePayload.jiraHost) ? gitHubClient : githubApi;

	await processBranch(
		github,
		messagePayload.webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		messagePayload.jiraHost,
		messagePayload.installationId,
		context.log
	);

}
