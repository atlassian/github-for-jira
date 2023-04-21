import { getLogger } from "config/logger";
import express, { Application } from "express";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";

describe("Workspace Get", () => {
	let app: Application;

	beforeEach(async () => {
		app = express();

		app.use(getFrontendApp());

		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});
	});

	it("Should fetch all orgs for a subscription", async () => {
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.query.cloudName = "test-site";
			req.csrfToken = jest.fn();
			res.locals.jiraHost = jiraHost;
			next();
		});

		await supertest(app)
			.get("/jira/workspace/")
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain("success\":true");
			});
	});

	it("Should return a 400 status if no jira domain is provided", async () => {
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query.cloudName = undefined;
			req.csrfToken = jest.fn();
			next();
		});

		await supertest(app)
			.get("/jira/workspace")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_JIRA_HOST);
			});
	});
});
