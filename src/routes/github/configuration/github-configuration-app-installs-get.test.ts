import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/github-server-app";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Express } from "express";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";

describe("GitHub Branches Get", () => {

	let installation: Installation;
	let gitHubServerApp: GitHubServerApp;
	let app: Express;

	beforeEach(async () => {
		const result = await new DatabaseStateCreator().forServer().create();
		installation = result.installation;
		gitHubServerApp = result.gitHubServerApp!;

		app = getFrontendApp();
	});

	it("Should successfully redirect to GitHub path for cloud", async () => {
		githubNock
			.get(`/`)
			.reply(200);

		githubNock
			.get(`/app`)
			.reply(200, {
				html_url: "https://github.com/apps/jira"
			});

		const result = await supertest(app)
			.get("/github/configuration/app-installations")
			.set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token"
				}));

		expect(result.status).toStrictEqual(302);
		expect(result.headers.location).toStrictEqual("https://github.com/apps/jira/installations/new?state=non-spa");
	});

	it("Should successfully regenerate URL and redirect to GitHub path for server", async () => {
		gheApiNock
			.get("")
			.reply(200);

		gheApiNock
			.get(`/app`)
			.reply(200, {
				html_url: "https://blahblah.com/github-apps/jira"
			});

		const result = await supertest(app)
			.get(`/github/${gitHubServerApp.uuid}/configuration/app-installations`)
			.set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost,
					githubToken: "random-token",
					gitHubUuid: gitHubServerApp.uuid
				}));

		expect(result.status).toStrictEqual(302);
		expect(result.headers.location).toStrictEqual("https://github.mydomain.com/github-apps/jira/installations/new?state=non-spa");
	});

	it("should redirect to oauth dance when no github token", async () => {
		const result = await supertest(app)
			.get(`/github/${gitHubServerApp.uuid}/configuration/app-installations`)
			.set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: installation.jiraHost
				}));

		expect(result.status).toStrictEqual(302);
		expect(result.headers.location).toContain("https://github.mydomain.com/login/oauth/authorize?");
	});

	it("should respond with 401 when not authorized", async () => {
		const result = await supertest(app)
			.get(`/github/${gitHubServerApp.uuid}/configuration/app-installations`);

		expect(result.status).toStrictEqual(401);
	});

	it("should respond with 401 when trying to access other tenant data", async () => {
		const result = await supertest(app)
			.get(`/github/${gitHubServerApp.uuid}/configuration/app-installations`)
			.set(
				"Cookie",
				generateSignedSessionCookieHeader({
					jiraHost: "https://bad-guy.atlassian.net"
				}));

		expect(result.status).toStrictEqual(401);
	});

});


