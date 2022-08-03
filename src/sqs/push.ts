import { Context, MessageHandler } from "./sqs";
import { processPush } from "../transforms/push";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { GitHubAppConfigPayload } from "./github-app-config-payload";

export type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: { name: string, login: string },
}

export type PushQueueMessagePayload = GitHubAppConfigPayload & {
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	jiraHost: string,
	installationId: number,
	webhookId: string,
	webhookReceived?: number,
}

export const pushQueueMessageHandler: MessageHandler<PushQueueMessagePayload> = async (context: Context<PushQueueMessagePayload>) => {
	const { payload, log } = context;
	const { webhookId, installationId, jiraHost } = payload;
	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});
	context.log.info("Handling push message from the SQS queue");
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, log);
	await processPush(gitHubInstallationClient, payload, log);
};
