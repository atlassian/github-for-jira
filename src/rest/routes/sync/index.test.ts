import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import express, { Express } from "express";
import { RootRouter } from "routes/router";
import supertest from "supertest";
import { encodeSymmetric } from "atlassian-jwt";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { sqsQueues } from "~/src/sqs/queues";

jest.mock("~/src/sqs/queues");
jest.mock("config/feature-flags");

describe("Checking the deferred request parsing route", () => {
	let app: Express;
	let installation: Installation;
	const installationIdForCloud = 1;
	const installationIdForServer = 2;
	let gitHubServerApp: GitHubServerApp;
	// let jwt: string;
	const testSharedSecret = "test-secret";
	const clientKey =  "jira-client-key";
	const getToken = ({
		secret = testSharedSecret,
		iss = clientKey,
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh",
		sub = "myAccount" } = {}): string => {
		return encodeSymmetric({
			qsh,
			iss,
			exp,
			sub
		}, secret);
	};
	beforeEach(async () => {
		app = getFrontendApp();
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: testSharedSecret,
			clientKey: clientKey
		});
		await Subscription.install({
			installationId: installationIdForCloud,
			host: jiraHost,
			hashedClientKey: installation.clientKey,
			gitHubAppId: undefined
		});
		gitHubServerApp = await GitHubServerApp.install({
			uuid: newUUID(),
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: installation.id
		}, jiraHost);
		await Subscription.install({
			installationId: installationIdForServer,
			host: jiraHost,
			hashedClientKey: installation.clientKey,
			gitHubAppId: gitHubServerApp.id
		});
		app = express();
		app.use(RootRouter);
	});

	describe("cloud", () => {
		it("should throw 401 error when no github token is passed", async () => {
			const resp = await supertest(app)
				.get("/rest/app/cloud/sync");

			expect(resp.status).toEqual(401);
		});

		it("should return 202 on correct post for /rest/app/cloud/sync one for Cloud app", async () => {
			return supertest(app)
				.post("/rest/app/cloud/sync")
				.set("authorization", `${getToken()}`)
				.send({
					installationId: installationIdForCloud,
					jiraHost,
					syncType: "full"
				})
				.expect(202)
				.then(() => {
					expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
						installationId: installationIdForCloud,
						jiraHost,
						startTime: expect.anything(),
						gitHubAppConfig: expect.objectContaining({ gitHubAppId: undefined, uuid: undefined })
					}), expect.anything(), expect.anything());
				});
		});

		it("should return 400 on incorrect commitsFromDate", async () => {
			const commitsFromDate = new Date(new Date().getTime() + 2000);
			return supertest(app)
				.post("/rest/app/cloud/sync")
				.set("authorization", `${getToken()}`)
				.send({
					installationId: installationIdForCloud,
					jiraHost,
					syncType: "full",
					commitsFromDate
				})
				.expect(400);
		});

		it("should return 400 on incorrect installationIdForCloud", async () => {
			const commitsFromDate = new Date(new Date().getTime() + 2000);
			return supertest(app)
				.post("/rest/app/cloud/sync")
				.set("authorization", `${getToken()}`)
				.send({
					installationId: 11,
					jiraHost,
					syncType: "full",
					commitsFromDate
				})
				.expect(400);
		});

	});

});
