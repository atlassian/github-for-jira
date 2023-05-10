import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

describe("Workspace Containers Post", () => {
	let app: Application;
	let sub: Subscription;

	beforeEach(async () => {
		sub = await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});
	});

	it("Should return a 400 status if no Jira host is provided", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/repositories/fetch")
			.send({
				ids: ["1", "2", "3"]
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_JIRA_HOST);
			});
	});

	it("Should return a 400 status if no repo ids provided", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/repositories/fetch")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("No repo IDs provided");
			});
	});

	it("Should return a 400 if provided IDs don't match Jira host", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		const repo1 = await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "my-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/my-repo",
			repoUrl: "github.com/atlassian/my-repo"
		});

		const repo2 = await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 2,
			repoName: "another-repo",
			repoOwner: "myorg",
			repoFullName: "myorg/another-repo",
			repoUrl: "github.com/myorg/another-repo"
		});

		const repo3 = await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 3,
			repoName: "sandbox",
			repoOwner: "atlassian",
			repoFullName: "atlassian/sandbox",
			repoUrl: "github.com/atlassian/sandbox"
		});

		await supertest(app)
			.post("/jira/repositories/fetch")
			.send({
				ids: [repo1.id + 10, repo2.id + 10, repo3.id + 10]
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("No matches found");
			});
	});
});
