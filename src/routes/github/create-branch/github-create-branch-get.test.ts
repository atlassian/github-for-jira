import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";
import { Subscription } from "models/subscription";

describe("GitHub Create Branch Get", () => {
	let app: Application;
	const gitHubInstallationId = 1234;
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
	describe("Testing the GET route", () => {
		beforeEach(async () => {
			await Subscription.create({
				gitHubInstallationId,
				jiraHost
			});
		});

		it.skip("should redirect to Github login if unauthorized", async () => {
			await supertest(app)
				.get("/github/create-branch").set(
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
			githubUserTokenNock(gitHubInstallationId);

			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);
			githubNock
				// .post("/graphql", { query: GetRepositoriesQuery, variables: { per_page: 20, order_by: 'UPDATED_AT' } })
				.post("/graphql", { query: GetRepositoriesQuery, variables: { per_page: 20, order_by: "UPDATED_AT" } })
				.reply(200, { data: { viewer: { repositories: { edges: [] } } } });
			githubNock
				.get("/user")
				.reply(200, { data: { login: "test-account" } });

			await supertest(app)
				.get("/github/create-branch").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.text).toContain("<div class=\"gitHubCreateBranch__header\">Create GitHub Branch</div>");
				});
		});
	});
});
