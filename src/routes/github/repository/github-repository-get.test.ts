import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { Subscription } from "~/src/models/subscription";

const randomString = "random-string";
describe("GitHub Repository Search", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query = { repoName: randomString };
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());
	});
	describe("Testing the Repository Search route", () => {

		it("should redirect to Github login if unauthorized", async () => {
			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					}))
				.expect(res => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain("github.com/login/oauth/authorize");
				});
		});

		it("should hit the create branch on GET if authorized", async () => {
			const gitHubInstallationId = 15;
			const orgName = "orgName";

			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});

			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get(`/app/installations/${gitHubInstallationId}`)
				.reply(200, { account: { login: orgName } });

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-account" });

			const queryStringInstallation = `${randomString} org:${orgName} in:name`;
			githubNock
				.get(`/search/repositories?q=${queryStringInstallation}`)
				.reply(200, {
					items: [{ full_name: "first", id: 2 }, { full_name: "second", id: 1 }]
				});

			const queryStringUser = `${randomString} org:${orgName} org:test-account in:name`;
			githubNock
				.get(`/search/repositories?q=${queryStringUser}`)
				.reply(200, {
					items: [{ full_name: "first", id: 1 }, { full_name: "second", id: 2 }]
				});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(2);
				});
		});

		it("should only return repos that user and installation have access too", async () => {
			const gitHubInstallationId = 15;
			const orgName = "orgName";

			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});

			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get(`/app/installations/${gitHubInstallationId}`)
				.reply(200, { account: { login: orgName } });

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			githubNock
				.get("/user")
				.reply(200, { login: "test-account" });

			const queryStringInstallation = `${randomString} org:${orgName} in:name`;
			githubNock
				.get(`/search/repositories?q=${queryStringInstallation}`)
				.reply(200, {
					items: [{ full_name: "first", id: 1 }, { full_name: "second", id: 22 }, { full_name: "second" }]
				});

			const queryStringUser = `${randomString} org:${orgName} org:test-account in:name`;
			githubNock
				.get(`/search/repositories?q=${queryStringUser}`)
				.reply(200, {
					items: [{ full_name: "first", id: 1 }, { full_name: "second", id: 9000 }]
				});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(1);
					expect(res.body?.repositories[0].id).toEqual(1);
				});
		});
	});
});
