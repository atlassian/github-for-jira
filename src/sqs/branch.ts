import { WebhookPayloadCreate } from "@octokit/webhooks";
import { Context, MessageHandler } from "./sqs";
import { processBranch } from "../github/branch";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { GitHubAppConfigPayload } from "./github-app-config-payload";

export type BranchMessagePayload = GitHubAppConfigPayload & {
	jiraHost: string,
	installationId: number,
	webhookReceived: number,
	webhookId: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 9KB.
	webhookPayload: WebhookPayloadCreate,
}

export const branchQueueMessageHandler: MessageHandler<BranchMessagePayload> = async (context: Context<BranchMessagePayload>) => {
	const messagePayload: BranchMessagePayload = context.payload;
	const { webhookId, installationId, jiraHost } = context.payload;
	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});
	context.log.info("Handling branch message from the SQS queue");

	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log);

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
