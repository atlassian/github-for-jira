import { Request, Response } from "express";
import { verify } from "@octokit/webhooks-methods";
import { GitHubServerApp } from "../models/git-hub-server-app";
import { Webhooks } from "./webhooks";
import { getLogger } from "../config/logger";
import { WebhookContext } from "./types";
import { validationResult } from "express-validator";

export const webhookReceiver = async (webhooks: Webhooks, request: Request, response: Response) => {
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
	try {
		if (uuid != "cloud") {
			const gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
			if (!gitHubServerApp) {
				response.status(400).send("GitHub app not found");
				return;
			}
			webhookSecret = gitHubServerApp?.webhookSecret;
		}

		const payload = request.body
		const matchesSignature = await verify(webhookSecret, JSON.stringify(payload), signatureSHA256);
		if (!matchesSignature) {
			response.status(400).send("signature does not match event payload and secret");
			return;
		}

		webhooks.receive(new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			signature: signatureSHA256,
			log: logger
		}));

		response.send(204);

	} catch (error) {
		logger.error(error);
	}

};