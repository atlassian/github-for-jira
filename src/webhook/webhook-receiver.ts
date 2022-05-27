import { Request, Response } from "express";
import { verify } from "@octokit/webhooks-methods";
import { GitHubServerApp } from "../models/git-hub-server-app";
import { getPayload } from "./get-payload";
import { Webhooks } from "./webhooks";
import { getLogger } from "../config/logger";
import { WebhookContext } from "./types";

const WEBHOOK_HEADERS = [
	"x-github-event",
	"x-hub-signature-256",
	"x-github-delivery",
];

export const webhookReceiver = async (webhooks: Webhooks, request: Request, response: Response) => {
	const missingHeaders = (WEBHOOK_HEADERS.filter((header) => !(header in request.headers))).join(", ");
	if (missingHeaders) {
		response.writeHead(400, {
			"content-type": "application/json",
		});
		response.end(`Required headers missing: ${missingHeaders}`);
		return;
	}
	// GitHub will abort the request if it does not receive a response within 10s
	let didTimeout = false;
	const timeout = setTimeout(() => {
		didTimeout = true;
		response.statusCode = 202;
		response.end("still processing\n");
	}, 9000).unref();

	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	const uuid = request.params.uuid;
	let webhookSecret: string = process.env.WEBHOOK_SECRET!;
	try {
		if (uuid != "cloud") {
			const gitHubServerApp = await GitHubServerApp.getGitHubServerAppForUuid(uuid)
			if (!gitHubServerApp) {
				response.statusCode = 404;
				response.end("GitHub app does not found\n");
				clearTimeout(timeout);
				return;
			}
			webhookSecret = gitHubServerApp?.webhookSecret;
		}

		const payload = await getPayload(request);
		const matchesSignature = await verify(webhookSecret, JSON.stringify(payload), signatureSHA256);
		if (!matchesSignature) {
			response.statusCode = 400;
			response.end("signature does not match event payload and secret\n");
			clearTimeout(timeout);
			return;
		}

		await webhooks.receive(new WebhookContext({
			id: id,
			name: eventName,
			payload: payload,
			signature: signatureSHA256,
			log: getLogger("webhook.receiver")
		}));
		clearTimeout(timeout);

		if (didTimeout) return;

		response.end("ok\n");
	} catch (error) {
		clearTimeout(timeout);

		if (didTimeout) return;

		const statusCode = error.status;
		response.statusCode = typeof statusCode !== "undefined" ? statusCode : 500;
		response.end(String(error));
	}

};