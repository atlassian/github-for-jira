import { processDeployment } from "../github/deployment";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { DeploymentMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";

export const deploymentQueueMessageHandler: MessageHandler<DeploymentMessagePayload> = async (context: SQSMessageContext<DeploymentMessagePayload>) => {
	const messagePayload: DeploymentMessagePayload = context.payload;
	if (messagePayload.webhookReceived === undefined || messagePayload.webhookPayload === undefined || messagePayload.webhookId === undefined) {
		context.log.error({ messagePayload }, "Missing required fields");
	}

	const { webhookId, jiraHost, installationId } = messagePayload;

	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	context.log.info("Handling deployment message from the SQS queue");

	const metrics = {
		trigger: "webhook",
		subTrigger: "deployment_status"
	};
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, metrics, context.log, messagePayload.gitHubAppConfig?.gitHubAppId);
	const entityAction = messagePayload.entityAction || "";
	await processDeployment(
		entityAction,
		gitHubInstallationClient,
		webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		jiraHost,
		installationId,
		context.log,
		messagePayload.gitHubAppConfig?.gitHubAppId,
		messagePayload.rateLimited
	);
};
