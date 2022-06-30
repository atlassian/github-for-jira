import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import Logger from "bunyan";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";
import { GitHubServerApp } from "models/github-server-app";
import { WebhookContext } from "./webhook-context";
import { webhookTimeout } from "~/src/util/webhook-timeout";
import { issueCommentWebhookHandler } from "~/src/github/issue-comment";
import { issueWebhookHandler } from "~/src/github/issue";
import { CryptorHttpClient } from "~/src/util/cryptor-http-client";

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const logger = getLogger("webhook.receiver");
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	const payload = request.body;
	let webhookSecret: string;
	try {
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			response.status(400).send("GitHub app not found");
			return;
		}
		webhookSecret = gitHubServerApp.webhookSecret;
		if (!webhookSecret) throw new Error("Cannot find webhookSecret for gitHubServerApp uuid: " + uuid);
		const verification = createHash(JSON.stringify(payload), await decrypt(webhookSecret, logger));
		if (verification != signatureSHA256) {
			response.status(400).send("signature does not match event payload and secret");
			return;
		}

		const webhookContext = new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			log: logger,
			action: payload.action
		});
		webhookRouter(webhookContext);
		response.sendStatus(204);

	} catch (error) {
		response.sendStatus(500);
		logger.error(error);
	}
};

const decrypt = async (plainText: string, logger: any) =>{
	return CryptorHttpClient.decrypt(plainText, logger as Logger);
};

const webhookRouter = (context: WebhookContext) => {
	switch (context.name) {
		case "push":
			GithubWebhookMiddleware(pushWebhookHandler)(context);
			break;
		case "issue_comment":
			if (context.action === "created" || context.action === "edited") {
				webhookTimeout(GithubWebhookMiddleware(issueCommentWebhookHandler))(context);
			}
			break;
		case "issues":
			if (context.action === "opened" || context.action === "edited") {
				GithubWebhookMiddleware(issueWebhookHandler)(context);
			}
			break;
	}
};

const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};
