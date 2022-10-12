import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("config/feature-flags");

const turnFF_OnOff = (newStatus: boolean) => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.CREATE_BRANCH, expect.anything(), expect.anything())
		.mockResolvedValue(newStatus);
};

describe("GitHub Create Branch Options Get", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query = { issue_key: "1", issue_summary: "random-string" };
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => ""
		}));
	});

	it("should hit the create branch option and render coming soon if ff if off", async () => {
		await supertest(app)
			.get("/create-branch-options").set(
				"Cookie",
				getSignedCookieHeader({
					jiraHost,
					githubToken: "random-token"
				}))
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("<h4 class=\"comingSoon__contentContainer__header\">Coming soon</h4>");
			});
	});

	it("should render create branch options if ff is on", async () => {
		turnFF_OnOff(true);
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
