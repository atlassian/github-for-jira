import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { Context, MessageHandler } from "./index";
import app from "../worker/app";
import { processDeployment } from "../github/deployment";

export type DeploymentMessagePayload = {
	jiraHost: string,
	installationId: number,
	webhookReceived: number,
	webhookId: string,

	// The original webhook payload from GitHub. We don't need to worry about the SQS size limit because metrics show
	// that payload size for deployment_status webhooks maxes out at 13KB.
	webhookPayload: WebhookPayloadDeploymentStatus,
}

export const deploymentQueueMessageHandler: MessageHandler<DeploymentMessagePayload> = async (context: Context<DeploymentMessagePayload>) => {

	context.log.info("Handling deployment message from the SQS queue")

	const messagePayload: DeploymentMessagePayload = context.payload;

	const github = await app.auth(messagePayload.installationId);

	await processDeployment(
		github,
		messagePayload.webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		messagePayload.jiraHost,
		messagePayload.installationId,
		context.log);
}
