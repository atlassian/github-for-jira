import { WebhookPayloadCreate } from "@octokit/webhooks";
import { Context, MessageHandler } from "./sqs";
import { processBranch } from "../github/branch";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
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

	context.log.info("Handling branch message from the SQS queue");

	const messagePayload: BranchMessagePayload = context.payload;
	const gitHubClient = new GitHubInstallationClient(getCloudInstallationId(messagePayload.installationId), context.log);

	await processBranch(
		gitHubClient,
		messagePayload.webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		messagePayload.jiraHost,
		messagePayload.installationId,
		context.log
	);

};
