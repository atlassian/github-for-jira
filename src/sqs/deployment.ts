import { Context, MessageHandler } from "./sqs";
import { workerApp } from "../worker/app";
import { processDeployment } from "../github/deployment";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { DeploymentMessagePayload } from "./sqs.types";

export const deploymentQueueMessageHandler: MessageHandler<DeploymentMessagePayload> = async (context: Context<DeploymentMessagePayload>) => {
	const messagePayload: DeploymentMessagePayload = context.payload;
	const { webhookId, jiraHost, installationId } = messagePayload;

	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	context.log.info("Handling deployment message from the SQS queue");

	const github = await workerApp.auth(installationId);
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log);

	await processDeployment(
		github,
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
