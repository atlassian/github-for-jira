import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { Subscription } from "models/subscription";
import { GetRepositoriesQuery } from "~/src/github/client/github-queries";
import { generateBranchName } from "routes/github/create-branch/github-create-branch-get";

describe("GitHub Create Branch Get", () => {
	let app: Application;
	const gitHubInstallationId = 1234;
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query = { issueKey: "1", issueSummary: "random-string", jiraHost };
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

		it("should redirect to Github login if unauthorized", async () => {
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
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
				.reply(200);

			githubNock
				.post("/graphql", { query: GetRepositoriesQuery, variables: { per_page: 20, order_by: "UPDATED_AT" } })
				.reply(200, { data: { viewer: { repositories: { edges: [] } } } });

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

	describe("GenerateBranchName", () => {
		it("should return just the issue key when no issuesummary", () => {
			expect(generateBranchName("ISSUEKEY", "")).toEqual("ISSUEKEY");
		});
		it("should replace spaces with hyphens", async () => {
			expect(generateBranchName("ISSUEKEY", "issue summary with spaces")).toBe("ISSUEKEY-issue-summary-with-spaces");
		});
		it("should replace slashes with hyphens", async () => {
			expect(generateBranchName("ISSUEKEY", "issue/summary/with/slashes/yo")).toBe("ISSUEKEY-issue-summary-with-slashes-yo");
		});
		it("should replace special characters with hypen(exld exempt special chars)", () => {
			expect(generateBranchName("ISSUEKEY", "A!B#CAT")).toEqual("ISSUEKEY-A-B-CAT");
		});
		it("should not replace exempt special characters with hypen", () => {
			expect(generateBranchName("ISSUEKEY", "CAT-._88")).toEqual("ISSUEKEY-CAT-._88");
		});
		it("should replace leading special characters with nothing", () => {
			expect(generateBranchName("ISSUEKEY", "/test/")).toEqual("ISSUEKEY-test");
		});
		it("should replace repeating hypens to a single hyphen", async () => {
			expect(generateBranchName("ISSUEKEY", "issue//////summary------with$$$$$$////slashes//yo")).toBe("ISSUEKEY-issue-summary-with-slashes-yo");
		});

	});
});
