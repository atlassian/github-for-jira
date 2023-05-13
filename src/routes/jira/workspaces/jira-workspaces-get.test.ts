import { getLogger } from "config/logger";
import express, { Application } from "express";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";

describe("Workspaces Get", () => {
	let app: Application;
	let sub: Subscription;
	let installation: Installation;
	let repo;
	let jwt: string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
		});

		sub = await Subscription.install({
			host: jiraHost,
			installationId: 1234,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});

		repo = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira-client-key"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	});

	it("Should return a 400 status if no Subscription is found for host", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await Subscription.uninstall({
			installationId: 1234,
			host: jiraHost,
			gitHubAppId: undefined
		});

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=Atlas")
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_SUBSCRIPTION);
			});
	});

	it("Should return a 400 status if no org name is provided in query params", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspaces/search")
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("No org name provided in query");
			});
	});

	it("Should return a 400 status if no matching repo is found for orgName + subscription id", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=incorrectorgname")
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Unable to find matching orgs for incorrectorgname");
			});
	});

	it("Should return a single org if only one match is found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await RepoSyncState.create({
			...repo,
			subscriptionId: sub.id
		});

		const workspaces = {
			success:true,
			workspaces: [
				{
					id: sub.id.toString(),
					name: "atlassian"
				}
			]
		};

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=atlas")
			.query({
				jwt
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(workspaces));
				expect(res.status).toBe(200);
			});
	});

	it("Should return multiple matches but only return each org once", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		const sub2 = await Subscription.install({
			host: jiraHost,
			installationId: 2345,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});

		const sub3 = await Subscription.install({
			host: jiraHost,
			installationId: 3456,
			hashedClientKey: "key-123",
			gitHubAppId: undefined
		});

		await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlas",
			repoFullName: "atlas/github-for-jira",
			repoUrl: "github.com/atlas/github-for-jira"
		});

		await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 2,
			repoName: "github-for-jira",
			repoOwner: "notamatch",
			repoFullName: "notamatch/github-for-jira",
			repoUrl: "github.com/notamatch/github-for-jira"
		});

		await RepoSyncState.create({
			subscriptionId: sub2.id,
			repoId: 3,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		});

		await RepoSyncState.create({
			subscriptionId: sub2.id,
			repoId: 3,
			repoName: "github-for-jira",
			repoOwner: "anotheratlasmatch",
			repoFullName: "anotheratlasmatch/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		});

		await RepoSyncState.create({
			subscriptionId: sub3.id,
			repoId: 3,
			repoName: "github-for-jira",
			repoOwner: "iworkatatlassian",
			repoFullName: "iworkatatlassian/github-for-jira",
			repoUrl: "github.com/iworkatatlassian/github-for-jira"
		});

		const workspaces = {
			success:true,
			workspaces: [
				{
					id: sub.id.toString(),
					name: "atlas"
				},
				{
					id: sub2.id.toString(),
					name: "atlassian"
				},
				{
					id: sub3.id.toString(),
					name: "iworkatatlassian"
				}
			]
		};

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=atlas")
			.query({
				jwt
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(workspaces));
				expect(res.status).toBe(200);
			});
	});
});
