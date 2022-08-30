import { processBranch } from "../github/branch";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { BranchMessagePayload, MessageHandler, SQSMessageContext } from "./sqs.types";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const branchQueueMessageHandler: MessageHandler<BranchMessagePayload> = async (context: SQSMessageContext<BranchMessagePayload>) => {
	const messagePayload: BranchMessagePayload = context.payload;
	const { webhookId, installationId, jiraHost } = context.payload;
	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	const gitHubAppId = messagePayload.gitHubAppConfig?.gitHubAppId;
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, context.log, gitHubAppId);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	context.log.info({ gitHubProduct }, "Handling branch message from the SQS queue");

	await processBranch(
		gitHubInstallationClient,
		messagePayload.webhookId,
		messagePayload.webhookPayload,
		new Date(messagePayload.webhookReceived),
		messagePayload.jiraHost,
		messagePayload.installationId,
		context.log,
		messagePayload.gitHubAppConfig?.gitHubAppId
	);
};
