import { processDeployment } from "../github/deployment";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { DeploymentMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";

export const deploymentQueueMessageHandler: MessageHandler<DeploymentMessagePayload> = async (context: SQSMessageContext<DeploymentMessagePayload>) => {
	const messagePayload: DeploymentMessagePayload = context.payload;
	const { webhookId, jiraHost, installationId } = messagePayload;

	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	context.log.info("Handling deployment message from the SQS queue");

	const { gitHubAppId, clientKey } = messagePayload.gitHubAppConfig || {};
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, gitHubAppId, clientKey);

	await processDeployment(
		gitHubInstallationClient,
		webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		jiraHost,
		installationId,
		context.log,
		messagePayload.gitHubAppConfig?.gitHubAppId
	);
};
