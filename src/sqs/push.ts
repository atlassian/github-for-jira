import {Context, MessageHandler} from "./index"
import enhanceOctokit from "../config/enhance-octokit";
import {processPush} from "../transforms/push";
import app from "../worker/app";
import {wrapLogger} from "probot/lib/wrap-logger";
import GitHubClient from "../github/client/github-client";

export type PayloadRepository = {
	id: number,
	name: string,
	full_name: string,
	html_url: string,
	owner: string,
}

export type PushQueueMessagePayload = {
	repository: PayloadRepository,
	shas: { id: string, issueKeys: string[] }[],
	jiraHost: string,
	installationId: number,
	webhookId: string,
	webhookReceived?: Date,
}

export const pushQueueMessageHandler : MessageHandler<PushQueueMessagePayload> = async (context : Context<PushQueueMessagePayload>) => {

	context.log.info("Handling push message from the SQS queue")

	const payload = context.payload;

	let githubOld;
	try {
		githubOld = await app.auth(payload.installationId);
	} catch (err) {
		context.log.warn({ err, payload }, "Could not authenticate for the supplied InstallationId");
		return;
	}
	enhanceOctokit(githubOld);
	const github = new GitHubClient(payload.installationId, context.log);
	await processPush(githubOld, github, payload, wrapLogger(context.log));
}
