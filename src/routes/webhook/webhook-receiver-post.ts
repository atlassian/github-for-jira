import { BinaryLike, createHmac } from "crypto";
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { getLogger } from "~/src/config/logger";
import { GitHubServerApp } from "~/src/models/git-hub-server-app";
import { WebhookContext } from "./webhook-context";

export const WebhookReceiverPost = async (request: Request, response: Response): Promise<void> => {
	const errors = validationResult(request);
	if (!errors.isEmpty()) {
		response.status(400).json({ errors: errors.array() });
		return;
	}
	const logger = getLogger("webhook.receiver");
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	let webhookSecret: string = process.env.WEBHOOK_SECRET!;
	const payload = request.body;
	try {
		if (uuid != "cloud") {
			const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
			if (!gitHubServerApp) {
				response.status(400).send("GitHub app not found");
				return;
			}
			webhookSecret = gitHubServerApp?.webhookSecret;
		}
		const verification = createHash(JSON.stringify(payload), webhookSecret);
		if (verification != signatureSHA256) {
			response.status(400).send("signature does not match event payload and secret");
			return;
		}

		const webhookContext = new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			log: logger
		});

		const action = "action" in payload ? payload.action : null;
		if (action) {
			invokeEventHandler(`${eventName}.${action}`, webhookContext);
		}
		invokeEventHandler(eventName, webhookContext);

		response.sendStatus(204);

	} catch (error) {
		logger.error(error);
	}
};

function invokeEventHandler(event: string, context: WebhookContext) {
	switch (event) {
		case "push":
			context.log.info("push event Received!");
			break;
		case "pull_request":
			context.log.info("pull req event Received!");
			break;
		case "pull_request.opened":
			context.log.info("pull req opened event Received!");
			break;
	}
}

function createHash(data: BinaryLike, secret: string): string {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
}