import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";
import { GitHubServerApp } from "models/github-server-app";
import { WebhookContext } from "./webhook-context";
import { webhookTimeout } from "~/src/util/webhook-timeout";
import { issueCommentWebhookHandler } from "~/src/github/issue-comment";
import { issueWebhookHandler } from "~/src/github/issue";
import { envVars } from "~/src/config/env";

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const logger = getLogger("webhook.receiver");
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	const payload = request.body;
	try {
		const webhookSecret = await getWebhookSecret(uuid);
		const verification = createHash(JSON.stringify(payload), webhookSecret);
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
		response.sendStatus(400);
		logger.error(error);
	}
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

const getWebhookSecret = async (uuid?: string) => {
	if (uuid) {
		const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			throw new Error(`GitHub app not found for uuid ${uuid}`);
		}
		return await gitHubServerApp.decrypt("webhookSecret");
	}
	if (!envVars.WEBHOOK_SECRET) {
		throw new Error("Environment variable 'WEBHOOK_SECRET' not defined");
	}
	return envVars.WEBHOOK_SECRET;
};
