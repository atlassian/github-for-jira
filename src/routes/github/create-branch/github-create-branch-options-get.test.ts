import { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { Installation } from "models/installation";
import { DatabaseStateCreator } from "test/utils/database-state-creator";

jest.mock("config/feature-flags");

describe("GitHub Create Branch Options Get", () => {
	let app: Application;
	let installation: Installation;
	beforeEach(async () => {
		app = getFrontendApp();
		const result = await (new DatabaseStateCreator().create());
		installation = result.installation;
		await result.subscription.destroy();
	});

	it("401 if no session/JWT", async () => {
		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123&jiraHost=" + encodeURIComponent(installation.jiraHost))
			.expect(res => {
				expect(res.status).toBe(401);
			});
	});

	it("No connection - should open the no-configuration page", async () => {
		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123").set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("<button class=\"aui-button aui-button-primary\" id=\"noConfiguration__ConnectToGH\">Connect GitHub organization</button>");
			});
	});

	it("With one cloud connection - should open the create-branch page", async () => {
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});
		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123").set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(307);
				expect(res.text).toBe("Temporary Redirect. Redirecting to /github/create-branch?issueKey=TEST-123");
			});
	});

	it("With one server connection - should open the create-branch page", async () => {
		const uuid = newUUID();
		const serverApp = await GitHubServerApp.install({
			uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 1
		}, installation.jiraHost);
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: serverApp.id
		});
		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123").set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(307);
				expect(res.text).toBe(`Temporary Redirect. Redirecting to /github/${uuid}/create-branch?issueKey=TEST-123`);
			});
	});

	it("With multiple server connections without cloud connection - should open the create-branch-options page", async () => {
		const uuid = newUUID();
		const uuid2 = newUUID();
		const serverApp = await GitHubServerApp.install({
			uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.123",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 1
		}, installation.jiraHost);
		const serverApp2 = await GitHubServerApp.install({
			uuid: uuid2,
			appId: 234,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 1
		}, installation.jiraHost);
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 123,
			hashedClientKey: "key-123",
			gitHubAppId: serverApp.id
		});
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 234,
			hashedClientKey: "key-123",
			gitHubAppId: serverApp2.id
		});

		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123").set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("Select your GitHub product");
			});
	});

	it("With both cloud & server connections - should open the create-branch-options page", async () => {
		const serverApp = await GitHubServerApp.install({
			uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 1
		}, installation.jiraHost);
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: serverApp.id
		});
		await Subscription.install({
			host: installation.jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});

		await supertest(app)
			.get("/create-branch-options?issueKey=TEST-123").set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("GitHub Cloud");
				expect(res.text).toContain("GitHub Enterprise Server");
			});
	});
});
