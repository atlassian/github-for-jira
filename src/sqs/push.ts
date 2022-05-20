import { Context, MessageHandler } from "./sqs";
import { processPush } from "../transforms/push";
import { wrapLogger } from "probot/lib/wrap-logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import {getGitHubBaseUrl} from "utils/check-github-app-type";
import {gheServerAuthAndConnectFlowFlag} from "utils/feature-flag-utils";

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
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);
	const github = await gheServerAuthAndConnectFlowFlag(jiraHost) ?
		new GitHubInstallationClient(getCloudInstallationId(context.payload.installationId, gitHubBaseUrl), context.log, gitHubBaseUrl) :
		new GitHubInstallationClient(getCloudInstallationId(context.payload.installationId), context.log);

	await processPush(github, context.payload, wrapLogger(context.log));
};
