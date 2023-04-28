import supertest from "supertest";
import express, { Application, NextFunction, Request, Response } from "express";
import { Installation } from "models/installation";
import { Subscription, SyncStatus } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { getLogger } from "config/logger";
import { v4 as uuid } from "uuid";
import { ApiRouter } from "routes/api/api-router";

describe("API Resync POST", () => {
	const gitHubInstallationId = 1234;
	let installation: Installation;
	// let subscription: Subscription;
	let gitHubServerApp: GitHubServerApp;
	let app: Application;

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
		installation = await Installation.create({
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

		gitHubServerApp = await GitHubServerApp.install({
			uuid: uuid(),
			appId: 123,
			installationId: installation.id,
			gitHubAppName: "test-github-server-app",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "client-id",
			gitHubClientSecret: "client-secret",
			privateKey: "private-key",
			webhookSecret: "webhook-secret"
		}, jiraHost);

		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			gitHubAppId: gitHubServerApp.id
		});
	});

	it("should return 400 if no parameters are provided", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/${gitHubServerApp.uuid}/resync`)
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Please provide at least one of the filter parameters!");
			});
	});

	it("should return 400 if no installations exist for provided IDs", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/${gitHubServerApp.uuid}/resync`)
			.send({
				statusTypes: ["PENDING", "COMPLETE"],
				installationIds: [installation.id + 1, installation.id + 2]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("No installations exist for provided IDs");
			});
	});

	it("should return 400 if commitsFromDate are present and are ahead of current date", async () => {
		app = createApp();
		const timeOneSecondFromNow = () => new Date(Date.now() + 1000);

		await supertest(app)
			.post(`/api/${gitHubServerApp.uuid}/resync`)
			.send({
				statusTypes: ["PENDING", "COMPLETE"],
				installationIds: [installation.id],
				commitsFromDate: timeOneSecondFromNow()
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Invalid date value, cannot select a future date!");
			});
	});

	it("should return 200 if all checks are met", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/${gitHubServerApp.uuid}/resync`)
			.send({
				statusTypes: ["PENDING", "COMPLETE"],
				installationIds: [installation.id]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});
	});
});
