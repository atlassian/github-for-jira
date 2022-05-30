import { Context, MessageHandler } from "./sqs";
import { processPush } from "../transforms/push";
import { wrapLogger } from "probot/lib/wrap-logger";
import { createInstallationClient } from "~/src/util/get-github-client-config";

export type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: { name: string, login: string },
}

export type PushQueueMessagePayload = {
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	jiraHost: string,
	installationId: number,
	webhookId: string,
	webhookReceived?: number,
}

export const pushQueueMessageHandler: MessageHandler<PushQueueMessagePayload> = async (context: Context<PushQueueMessagePayload>) => {
	context.log.info("Handling push message from the SQS queue");
	const { payload, log } = context;
	const gitHubInstallationClient = await createInstallationClient(payload.installationId, payload.jiraHost, log);
	await processPush(gitHubInstallationClient, payload, wrapLogger(log));
};
