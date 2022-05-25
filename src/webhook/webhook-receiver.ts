import { Request, Response } from "express";
// import { GitHubServerApp } from "../models/git-hub-server-app";
import { getPayload } from "./get-payload";
import { Webhooks } from "./webhooks";

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
		response.end(
			JSON.stringify({
				error: `Required headers missing: ${missingHeaders}`,
			})
		);

		return;
	}
	const eventName = request.headers["x-github-event"] as string;
	const signatureSHA256 = request.headers["x-hub-signature-256"] as string;
	const id = request.headers["x-github-delivery"] as string;
	//const uuid = request.params.uuid;
	/* let webhookSecret = process.env.WEBHOOK_SECRET;
	if (uuid != "cloud") {
		const gitHubServerApp = await GitHubServerApp.getGitHubServerAppForUuid(uuid)
		if (!gitHubServerApp) {
			response.statusCode = 404;
			response.end("GitHub app not found\n");
			return;
		}
		webhookSecret = gitHubServerApp?.webhookSecret;
		console.log(webhookSecret);
		
	} */


	// GitHub will abort the request if it does not receive a response within 10s
	let didTimeout = false;
	const timeout = setTimeout(() => {
		didTimeout = true;
		response.statusCode = 202;
		response.end("still processing\n");
	}, 9000).unref();
	try {
		const payload = await getPayload(request);

		await webhooks.receive({
			id: id,
			name: eventName,
			payload: payload,
			signature: signatureSHA256,
		});
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