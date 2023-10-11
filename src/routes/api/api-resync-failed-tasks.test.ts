import express, { Application, NextFunction, Request, Response } from "express";
import { mocked } from "ts-jest/utils";
import { booleanFlag } from "~/src/config/feature-flags";
import { getLogger } from "~/src/config/logger";
import { ApiRouter } from "./api-router";
import supertest from "supertest";
import { Installation } from "~/src/models/installation";
import { Subscription, SyncStatus } from "~/src/models/subscription";


jest.mock("config/feature-flags");
jest.mock("~/src/sync/sync-utils");

const mockBooleanFlag = mocked(booleanFlag);

const createApp = () => {
	const app = express();
	app.use((req: Request, _: Response, next: NextFunction) => {
		req.log = getLogger("test");
		next();
	});
	app.use("/api", ApiRouter);
	return app;
};

describe("api-resync-failed-tasks", () => {

	let app: Application;
	let subscription: Subscription;
	const gitHubInstallationId = 1234;

	beforeEach(async () => {
		await Installation.create({
			gitHubInstallationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			syncStatus: SyncStatus.PENDING
		});

		mockBooleanFlag.mockResolvedValue(true);
	});

	it("should return 400 if slauth header is missing", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/resync-failed-tasks`)
			.then((res) => {
				expect(res.status).toBe(401);
			});
	});

	it("should return error message if input is empty", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/resync-failed-tasks`)
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Please provide at least one subscription id");
			});
	});

	it("should return error message if target task is empty", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/resync-failed-tasks`)
			.send({ subscriptionsIds: [123] })
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Please provide target type");
			});
	});

	it("should resync failed tasks", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/resync-failed-tasks`)
			.send({ subscriptionsIds: [subscription.id], targetTasks: ["dependabotAlert"] })
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Triggered backfill successfully");
			});

	});

});