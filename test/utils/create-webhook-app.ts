import { BinaryLike, createHmac } from "crypto";
import express, { Express } from "express";
import { json } from "body-parser";
import supertest from "supertest";
import { v4 as uuid } from "uuid";
import { envVars } from "config/env";
import { WebhookReceiverPost } from "~/src/routes/github/webhook/webhook-receiver-post";

export type WebhookApp = Express & {
	receive: (event: any) => Promise<any>
}

export const createWebhookApp = async (): Promise<WebhookApp> => {
	const app: WebhookApp = express() as any;
	app.use(json());
	app.post("/github/webhooks", WebhookReceiverPost);
	app.receive = async (event: any) => {
		await supertest(app)
			.post("/github/webhooks")
			.send(event.payload)
			.set("x-github-event", event.name)
			.set("x-hub-signature-256", createHash(JSON.stringify(event.payload), envVars.WEBHOOK_SECRET))
			.set("x-github-delivery", uuid())
			.set("content-type", "application/json")
			.expect(204);
	};
	return app;
};

const createHash = (data: BinaryLike, secret: string): string => {
	return `sha256=${createHmac("sha256", secret)
		.update(data)
		.digest("hex")}`;
};
