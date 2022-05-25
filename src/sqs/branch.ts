import { WebhookPayloadCreate } from "@octokit/webhooks";
import { Context, MessageHandler } from "./sqs";
import { processBranch } from "../github/branch";
import { createInstallationClient } from "utils/check-github-app-type";

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
	const gitHubInstallationClient = await createInstallationClient(messagePayload.installationId, jiraHost, context.log);

	await processBranch(
		gitHubInstallationClient,
		messagePayload.webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		messagePayload.jiraHost,
		messagePayload.installationId,
		context.log
	);

};
