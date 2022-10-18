import { BinaryLike, createHmac } from "crypto";
import express, { Express } from "express";
import supertest from "supertest";
import { v4 as uuid } from "uuid";
import { envVars } from "config/env";
import { WebhookReceiverPost } from "~/src/routes/github/webhook/webhook-receiver-post"

export type WrapFrontendApp = Express & {
	receive: (event: any) => Promise<any>
}

export const wrapFrontEndAppWithReceive = async (): Promise<WrapFrontendApp> => {
	const app: WrapFrontendApp = express() as any;
	app.post("/github/webhooks", WebhookReceiverPost);
	app.receive = async (event: any) => {
		await supertest(app)
			.post("/github/webhooks")
			.set("x-github-event", event.name)
			.set("x-hub-signature-256", createHash(JSON.stringify(event.payload), envVars.WEBHOOK_SECRET))
			.set("x-github-delivery", uuid())
			.set("content-type", "application/json")
			.send(JSON.stringify(event.payload))
			.expect(204);
	}
	return app;
}

const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};
