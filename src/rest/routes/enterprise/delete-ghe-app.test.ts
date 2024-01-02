import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import express, { Express } from "express";
import { RootRouter } from "routes/router";
import supertest from "supertest";
import { encodeSymmetric } from "atlassian-jwt";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

jest.mock("~/src/sqs/queues");
jest.mock("config/feature-flags");

describe("Checking the sync request parsing route", () => {
	let app: Express;
	let installation: Installation;
	const installationIdForCloud = 1;
	const installationIdForServer = 2;
	const uuid = newUUID();
	let gitHubServerApp: GitHubServerApp;
	const testSharedSecret = "test-secret";
	const clientKey = "jira-client-key";
	const getToken = ({
		secret = testSharedSecret,
		iss = clientKey,
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh",
		sub = "myAccount"
	} = {}): string => {
		return encodeSymmetric(
			{
				qsh,
				iss,
				exp,
				sub
			},
			secret
		);
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
		gitHubServerApp = await GitHubServerApp.install(
			{
				uuid: uuid,
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "myghsecret",
				webhookSecret: "mywebhooksecret",
				privateKey: "myprivatekey",
				installationId: installation.id
			},
			jiraHost
		);
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
			const resp = await supertest(app).delete(
				`/rest/app/${gitHubServerApp.uuid}`
			);
			expect(resp.status).toEqual(401);
		});

		it("should return 400 on no uuid", async () => {
			const resp = await supertest(app)
				.delete(`/rest/app/cloud`)
				.set("authorization", `${getToken()}`);
			expect(resp.status).toEqual(400);
		});

		it("should return 200 on correct uuid", async () => {
			const resp = await supertest(app)
				.delete(`/rest/app/${gitHubServerApp.uuid}`)
				.set("authorization", `${getToken()}`);
			expect(resp.status).toEqual(200);
		});
	});
});
