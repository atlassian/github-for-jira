import { Context, MessageHandler } from "./sqs";
import { processBranch } from "../github/branch";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { BranchMessagePayload } from "./sqs.types";

export const branchQueueMessageHandler: MessageHandler<BranchMessagePayload> = async (context: Context<BranchMessagePayload>) => {
	const messagePayload: BranchMessagePayload = context.payload;
	const { webhookId, installationId, jiraHost } = context.payload;
	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});
	context.log.info("Handling branch message from the SQS queue");

	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, messagePayload.gitHubAppConfig?.gitHubAppId);

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
