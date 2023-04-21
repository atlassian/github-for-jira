import { getLogger } from "config/logger";
import express, { Application } from "express";
// import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
// import { RepoSyncState } from "models/reposyncstate";

describe("Workspace Get", () => {
	let app: Application;
	// let sub: Subscription;
	// let repo;

	beforeEach(async () => {
		await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined,
		});

		// repo = {
		// 	subscriptionId: sub.id,
		// 	repoId: 1,
		// 	repoName: "github-for-jira",
		// 	repoOwner: "atlassian",
		// 	repoFullName: "atlassian/github-for-jira",
		// 	repoUrl: "github.com/atlassian/github-for-jira"
		// };
	});

	it("Should return a 400 status if no jira domain is provided", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_JIRA_HOST);
			});
	});

	it("Should return a 400 status if no org id is provided in query params", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			req.query.searchQuery = "test-repo";
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Missing org ID or repo name");
			});
	});

	it("Should return a 400 status if no repo name is provided in query params", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			req.query.connectedOrgId = "12";
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Missing org ID or repo name");
			});
	});

	// it("Should return a 400 status if no matching repo is found for orgName + subscription id", async () => {
	// 	app = express();
	// 	app.use((req, res, next) => {
	// 		req.log = getLogger("test");
	// 		res.locals.jiraHost = jiraHost;
	// 		req.query.searchQuery = "incorrectorgname";
	// 		req.csrfToken = jest.fn();
	// 		next();
	// 	});
	// 	app.use(getFrontendApp());
	//
	// 	await RepoSyncState.create({
	// 		...repo,
	// 		subscriptionId: sub.id
	// 	});
	//
	// 	await supertest(app)
	// 		.get("/jira/workspace")
	// 		.expect(res => {
	// 			expect(res.status).toBe(400);
	// 			expect(res.text).toContain("Unable to find matching repo for incorrectorgname");
	// 		});
	// });

	// it("Should fetch all orgs for a subscription", async () => {
	// 	app = express();
	// 	app.use((req, res, next) => {
	// 		req.log = getLogger("test");
	// 		req.query.searchQuery = "test-org";
	// 		req.csrfToken = jest.fn();
	// 		res.locals.jiraHost = jiraHost;
	// 		req.query.searchQuery = "atlassian";
	// 		next();
	// 	});
	// 	app.use(getFrontendApp());
	//
	// 	await RepoSyncState.create({
	// 		...repo,
	// 		subscriptionId: sub.id
	// 	});
	//
	// 	await supertest(app)
	// 		.get("/jira/workspace")
	// 		.expect(res => {
	// 			expect(res.status).toBe(200);
	// 			expect(res.text).toContain("{\"success\":true,\"orgData\":{\"id\":1234,\"name\":\"atlassian\",\"url\":\"github.com/atlassian/\",\"avatarUrl\":\"avatarurl\"}}");
	// 		});
	// });
});
