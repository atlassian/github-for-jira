import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";

describe("Workspaces Repositories Get", () => {
	let app: Application;
	let sub: Subscription;
	let installation: Installation;
	let jwt: string;
	let repo;

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

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira-client-key"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	});

	it("Should return a 400 status if no repo name is provided in query params", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Missing repo name");
			});
	});

	it("Should return a 400 status if no Subscription is found for host", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id + 1}&searchQuery=new`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_SUBSCRIPTION);
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
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}&searchQuery=test-repo`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain("Repository not found");
			});
	});

	it("Should return all repos for matching Subscription ID and partial matching repo name", async () => {
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

		const repo1 = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/new-repo",
			repoUrl: "github.com/atlassian/new-repo"
		};

		const repo2 = {
			subscriptionId: sub.id,
			repoId: 2,
			repoName: "another-new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/another-new-repo",
			repoUrl: "github.com/atlassian/another-new-repo"
		};

		const repo3 = {
			subscriptionId: sub.id,
			repoId: 3,
			repoName: "this-ones-an-oldie",
			repoOwner: "atlassian",
			repoFullName: "atlassian/this-ones-an-oldie",
			repoUrl: "github.com/atlassian/this-ones-an-oldie"
		};

		const repo4 = {
			subscriptionId: sub.id,
			repoId: 4,
			repoName: "imNew",
			repoOwner: "atlassian",
			repoFullName: "atlassian/imnew",
			repoUrl: "github.com/atlassian/imnew"
		};

		const sub2repo = {
			subscriptionId: sub2.id,
			repoId: 4,
			repoName: "newbutshouldntmatch",
			repoOwner: "atlassian",
			repoFullName: "atlassian/newbutshouldntmatch",
			repoUrl: "github.com/atlassian/newbutshouldntmatch"
		};

		const repoOne = await RepoSyncState.create({
			...repo1,
			subscriptionId: sub.id
		});

		const repoTwo = await RepoSyncState.create({
			...repo2,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...repo3,
			subscriptionId: sub.id
		});

		const repoFour = await RepoSyncState.create({
			...repo4,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...sub2repo,
			subscriptionId: sub2.id
		});

		const response = {
			success: true,
			repositories: [
				{
					id: repoOne.repoId.toString(),
					name: "new-repo",
					workspaceId: sub.id.toString()
				},
				{
					id: repoTwo.repoId.toString(),
					name: "another-new-repo",
					workspaceId: sub.id.toString()
				},
				{
					id: repoFour.repoId.toString(),
					name: "imNew",
					workspaceId: sub.id.toString()
				}
			]
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}&searchQuery=new`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all repos for partial matching repo name (no workspace ID provided)", async () => {
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

		const repo1 = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/new-repo",
			repoUrl: "github.com/atlassian/new-repo"
		};

		const repo2 = {
			subscriptionId: sub.id,
			repoId: 2,
			repoName: "another-new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/another-new-repo",
			repoUrl: "github.com/atlassian/another-new-repo"
		};

		const repo3 = {
			subscriptionId: sub.id,
			repoId: 3,
			repoName: "this-ones-an-oldie",
			repoOwner: "atlassian",
			repoFullName: "atlassian/this-ones-an-oldie",
			repoUrl: "github.com/atlassian/this-ones-an-oldie"
		};

		const repo4 = {
			subscriptionId: sub.id,
			repoId: 4,
			repoName: "imNew",
			repoOwner: "atlassian",
			repoFullName: "atlassian/imnew",
			repoUrl: "github.com/atlassian/imnew"
		};

		const sub2repo = {
			subscriptionId: sub2.id,
			repoId: 4,
			repoName: "newbutshouldmatch",
			repoOwner: "atlassian",
			repoFullName: "atlassian/newbutshouldmatch",
			repoUrl: "github.com/atlassian/newbutshouldmatch"
		};

		const repoOne = await RepoSyncState.create({
			...repo1,
			subscriptionId: sub.id
		});

		const repoTwo = await RepoSyncState.create({
			...repo2,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...repo3,
			subscriptionId: sub.id
		});

		const repoFour = await RepoSyncState.create({
			...repo4,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...sub2repo,
			subscriptionId: sub2.id
		});

		const response = {
			success: true,
			repositories: [
				{
					id: repoOne.repoId.toString(),
					name: "new-repo",
					workspaceId: sub.id.toString()
				},
				{
					id: repoTwo.repoId.toString(),
					name: "another-new-repo",
					workspaceId: sub.id.toString()
				},
				{
					id: repoFour.repoId.toString(),
					name: "imNew",
					workspaceId: sub.id.toString()
				},
				{
					id: sub2repo.repoId.toString(),
					name: "newbutshouldmatch",
					workspaceId: sub2.id.toString()
				}
			]
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=new`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return paginated repositories based on page and limit parameters", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		const repo1 = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "repo1",
			repoOwner: "owner",
			repoFullName: "owner/repo1",
			repoUrl: "github.com/owner/repo1"
		};

		const repo2 = {
			subscriptionId: sub.id,
			repoId: 2,
			repoName: "repo2",
			repoOwner: "owner",
			repoFullName: "owner/repo2",
			repoUrl: "github.com/owner/repo2"
		};

		const repo3 = {
			subscriptionId: sub.id,
			repoId: 3,
			repoName: "repo3",
			repoOwner: "owner",
			repoFullName: "owner/repo3",
			repoUrl: "github.com/owner/repo3"
		};

		const repo4 = {
			subscriptionId: sub.id,
			repoId: 4,
			repoName: "repo4",
			repoOwner: "owner",
			repoFullName: "owner/repo4",
			repoUrl: "github.com/owner/repo4"
		};

		await RepoSyncState.create({
			...repo1,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...repo2,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...repo3,
			subscriptionId: sub.id
		});

		await RepoSyncState.create({
			...repo4,
			subscriptionId: sub.id
		});

		const responsePage1 = {
			success: true,
			repositories: [
				{
					id: "1",
					name: "repo1",
					workspaceId: sub.id.toString()
				},
				{
					id: "2",
					name: "repo2",
					workspaceId: sub.id.toString()
				}
			]
		};

		const responsePage2 = {
			success: true,
			repositories: [
				{
					id: "3",
					name: "repo3",
					workspaceId: sub.id.toString()
				},
				{
					id: "4",
					name: "repo4",
					workspaceId: sub.id.toString()
				}
			]
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}&searchQuery=repo&page=1&limit=2`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(responsePage1));
			});

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}&searchQuery=repo&page=2&limit=2`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(responsePage2));
			});
	});

	it("Should return paginated repositories when number of repositories exceeds the default limit", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp());

		const subscriptionId = sub.id.toString();

		const repositories = [
			{
				id: "1",
				name: "repo1",
				workspaceId: subscriptionId
			},
			{
				id: "2",
				name: "repo2",
				workspaceId: subscriptionId
			},
			{
				id: "3",
				name: "repo3",
				workspaceId: subscriptionId
			},
			{
				id: "4",
				name: "repo4",
				workspaceId: subscriptionId
			},
			{
				id: "5",
				name: "repo5",
				workspaceId: subscriptionId
			},
			{
				id: "6",
				name: "repo6",
				workspaceId: subscriptionId
			},
			{
				id: "7",
				name: "repo7",
				workspaceId: subscriptionId
			},
			{
				id: "8",
				name: "repo8",
				workspaceId: subscriptionId
			},
			{
				id: "9",
				name: "repo9",
				workspaceId: subscriptionId
			},
			{
				id: "10",
				name: "repo10",
				workspaceId: subscriptionId
			},
			{
				id: "11",
				name: "repo11",
				workspaceId: subscriptionId
			}
		];

		const createRepositories = repositories.map(repo =>
			RepoSyncState.create({
				subscriptionId: sub.id,
				repoId: repo.id,
				repoName: repo.name,
				repoOwner: "owner",
				repoFullName: `owner/${repo.name}`,
				repoUrl: `github.com/owner/${repo.name}`
			})
		);

		await Promise.all(createRepositories);

		const response = {
			success: true,
			repositories: repositories.slice(0, 10) // default limit
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${sub.id}&searchQuery=repo`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

});
