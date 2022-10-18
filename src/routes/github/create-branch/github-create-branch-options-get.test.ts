import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";

describe("GitHub Create Branch Options Get", () => {
	let app: Application;
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

	it("should hit the create branch option", async () => {
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("<div class=\"gitHubCreateBranchOptions__header\">Create GitHub Branch</div>");
			});
	});
});
