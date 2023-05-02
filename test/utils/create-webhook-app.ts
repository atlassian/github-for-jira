import { BinaryLike, createHmac } from "crypto";
import express, { Express } from "express";
import supertest from "supertest";
import { v4 as uuid } from "uuid";
import { envVars } from "config/env";
import { RootRouter } from "routes/router";

type Event = {
	name: string,
	payload: object
}

export type WebhookApp = Express & {
	receive: (event: Event) => Promise<void>
}

export const createWebhookApp = async (): Promise<WebhookApp> => {
	const upToDateWebhookSecret = JSON.parse(envVars.WEBHOOK_SECRETS)[0];
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const app: WebhookApp = express() as any;
	app.use(RootRouter);
	app.receive = async (event: Event) => {
		await supertest(app)
			.post("/github/webhooks")
			.send(event.payload)
			.set("x-github-event", event.name)
			.set("x-hub-signature-256", createHash(JSON.stringify(event.payload), upToDateWebhookSecret))
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
