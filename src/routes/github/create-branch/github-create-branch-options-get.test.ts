import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { v4 as newUUID } from "uuid";

jest.mock("config/feature-flags");

describe("GitHub Create Branch Options Get", () => {
	let app: Application;
	const setupGitHubCloudPingNock = () => {
		githubNock.get("/").reply(200);
	};
	const setupGHEPingNock = () => {
		gheApiNock.get("").reply(200);
	};
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query = { issueKey: "1", issueSummary: "random-string" };
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());
	});

	it("No gitHubToken - should open the no-configuration page", async () => {
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("<button class=\"aui-button aui-button-primary\" id=\"noConfiguration__ConnectToGH\">Connect GitHub organization</button>");
			});
	});

	it("Has gitHubToken, but no connection - should open the no-configuration page", async () => {
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("<button class=\"aui-button aui-button-primary\" id=\"noConfiguration__ConnectToGH\">Connect GitHub organization</button>");
			});
	});

	it("Has gitHubToken, with one cloud connection - should open the create-branch page", async () => {
		setupGitHubCloudPingNock();
		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			clientKey: "key-123",
			gitHubAppId: undefined
		});
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(302);
				expect(res.text).toBe("Found. Redirecting to /github/create-branch");
			});
	});

	it("Has gitHubToken, with one server connection - should open the create-branch page", async () => {
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
		});
		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			clientKey: "key-123",
			gitHubAppId: serverApp.id
		});
		when(booleanFlag).calledWith(
			BooleanFlags.GHE_SERVER,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);
		setupGHEPingNock();
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(302);
				expect(res.text).toBe(`Found. Redirecting to /github/${uuid}/create-branch`);
			});
	});

	it("Has gitHubToken, with both cloud & server connections - should open the create-branch-options page", async () => {
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
		});
		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			clientKey: "key-123",
			gitHubAppId: serverApp.id
		});
		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			clientKey: "key-123",
			gitHubAppId: undefined
		});

		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("GitHub Cloud");
				expect(res.text).toContain("GitHub Enterprise Server");
				expect(res.text).toContain("<div class=\"gitHubCreateBranchOptions__header\">Create GitHub Branch</div>");
			});
	});
});
