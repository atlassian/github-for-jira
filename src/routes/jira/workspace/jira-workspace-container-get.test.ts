import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { GitHubRepo } from "routes/jira/workspace/jira-workspace-containers-get";

describe("Workspace Get", () => {
	let app: Application;
	let sub: Subscription;
	let repo;

	beforeEach(async () => {
		sub = await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});
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
			req.query.workspaceId = "12";
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

	it("Should return a 400 status if no subscription is found for jiraHost and provided org id", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			req.query.workspaceId = sub.id + 1;
			req.query.searchQuery = "test-repo";
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_GITHUB_SUBSCRIPTION);
			});
	});

	it("Should return a 400 status if no matching repo is found for orgName + subscription id", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			res.locals.jiraHost = jiraHost;
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			req.query.workspaceId = (sub.id);
			req.query.searchQuery = "incorrectreponame";
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		repo = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};

		await RepoSyncState.create({
			...repo,
			subscriptionId: sub.id
		});

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Repository not found");
			});
	});

	it("Should fetch all orgs for a subscription", async () => {
		app = express();
		app.use((req, res, next) => {
			req.log = getLogger("test");
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			req.query.workspaceId = sub.id;
			req.query.searchQuery = "github-for-jira";
			req.csrfToken = jest.fn();
			res.locals.jiraHost = jiraHost;
			next();
		});
		app.use(getFrontendApp());

		repo = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};

		await RepoSyncState.create({
			...repo,
			subscriptionId: sub.id
		});

		const thing = await RepoSyncState.findBySubscriptionIdAndRepoName(sub.id, "github-for-jira");

		const repoData: GitHubRepo = {
			id: thing!.id,
			name: "github-for-jira",
			providerName: "GitHub for Jira",
			url: "github.com/atlassian/github-for-jira",
			avatarUrl: null,
			lastUpdatedDate: thing?.updatedAt
		};

		const response = {
			success: true,
			repoData
		};

		await supertest(app)
			.get("/jira/workspace/containers")
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
