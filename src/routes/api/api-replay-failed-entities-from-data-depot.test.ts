
import express, { Application, NextFunction, Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { ApiRouter } from "./api-router";
import supertest from "supertest";
import { Subscription, SyncStatus } from "~/src/models/subscription";
import { Installation } from "~/src/models/installation";

describe("api-replay-failed-entities-from-data-depot", () => {

	let app: Application;
	//let subscription: Subscription;
	const gitHubInstallationId = 1234;

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			next();
		});
		app.use("/api", ApiRouter);
		return app;
	};

	beforeEach(async () => {
		await Installation.create({
			gitHubInstallationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});

		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			syncStatus: SyncStatus.PENDING
		});

	});

	it("should return 400 if slauth header is missing", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.then((res) => {
				expect(res.status).toBe(401);
			});
	});

	it("should return message if input is empty", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({ replayEntities: [] })
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Replay entities are empty");
			});
	});

	it("should log error message if subscription is not found", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({
				replayEntities: [{
					"gitHubInstallationId": 123,
					"hashedJiraHost": "hashedJiraHost",
					"identifier": "d-1234567-1"
				}]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("No subscription found");
			});
	});

});