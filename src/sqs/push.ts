import { Context, MessageHandler } from "./index"
import { processPush } from "../transforms/push";
import { wrapLogger } from "probot/lib/wrap-logger";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";

export type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: {name: string, login: string},
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

	context.log.info("Handling push message from the SQS queue")

	const payload = context.payload;

	const installationId = getCloudInstallationId(payload.installationId);
	const github = await GitHubClient.build(installationId, context.log);
	await processPush(github, payload, wrapLogger(context.log));
}
