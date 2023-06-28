import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { DEFAULT_AVATAR } from "routes/jira/security/workspaces/jira-security-workspaces-post";

const createSubscriptionWithMultipleReposCloud = async () => {
	const sub = await Subscription.create({
		gitHubInstallationId: 1234,
		jiraHost,
		jiraClientKey: "client-key",
		avatarUrl: "http://myavatarurl"
	});

	const repo1 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 1,
		repoName: "thisistheexactmatch",
		repoOwner: "owner",
		repoFullName: "owner/thisistheexactmatch",
		repoUrl: "https://github.com/owner/thisistheexactmatch"
	});

	const repo2 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 2,
		repoName: "thisisnot",
		repoOwner: "owner",
		repoFullName: "owner/thisisnot",
		repoUrl: "https://github.com/owner/thisisnot"
	});

	const repo3 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 2,
		repoName: "thisisnteither",
		repoOwner: "owner",
		repoFullName: "owner/thisisnteither",
		repoUrl: "https://github.com/owner/thisisnteither"
	});

	return { sub, repo1, repo2, repo3 };
};

const createSubscriptionWithMultipleReposServer = async () => {
	const sub = await Subscription.create({
		gitHubInstallationId: 1234,
		jiraHost,
		jiraClientKey: "client-key",
		avatarUrl: "http://myavatarurl"
	});

	const repo1 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 1,
		repoName: "thisistheexactmatch",
		repoOwner: "owner",
		repoFullName: "owner/thisistheexactmatch",
		repoUrl: "https://github.internal.atlassian.com/owner/thisistheexactmatch"
	});

	const repo2 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 2,
		repoName: "thisisnot",
		repoOwner: "owner",
		repoFullName: "owner/thisisnot",
		repoUrl: "https://github.internal.atlassian.com/owner/thisisnot"
	});

	const repo3 = await RepoSyncState.create({
		subscriptionId: sub.id,
		repoId: 2,
		repoName: "thisisnteither",
		repoOwner: "owner",
		repoFullName: "owner/thisisnteither",
		repoUrl: "https://github.internal.atlassian.com/owner/thisisnteither"
	});

	return { sub, repo1, repo2, repo3 };
};

describe("Repositories Ge4t", () => {
	let app: Application;
	let installation: Installation;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
		});
	});

	const generateJwt = async (query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: "/jira/security/workspaces/repositories/search",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 400 status if no workspaceId is passed as a query param", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/security/workspaces/repositories/search?searchQuery=my-repo")
			.set({
				authorization: `JWT ${await generateJwt({
					searchQuery: "my-repo"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_WORKSPACE_ID);
			});
	});

	it("Should return a 400 status if no repoName is passed as a query param", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/security/workspaces/repositories/search?workspaceId=1234")
			.set({
				authorization: `JWT ${await generateJwt({
					workspaceId: "1234"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_CONTAINER_NAME);
			});
	});

	it("Should return an empty array if no matching repositories are found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const response = {
			success: true,
			containers: []
		};

		await supertest(app)
			.get("/jira/security/workspaces/repositories/search?workspaceId=1234&searchQuery=my-repo")
			.set({
				authorization: `JWT ${await generateJwt({
					workspaceId: "1234",
					searchQuery: "my-repo"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should only return one repo for exact repoName match", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const { sub, repo1 } = await createSubscriptionWithMultipleReposCloud();
		const { repoId, repoName, repoUrl, updatedAt } = repo1;

		const response = {
			success: true,
			containers: [
				{
					id: repoId.toString(),
					name: repoName,
					url: repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: updatedAt
				}
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/repositories/search?workspaceId=${sub.gitHubInstallationId.toString()}&searchQuery=thisistheexactmatch`)
			.set({
				authorization: `JWT ${await generateJwt({
					workspaceId: sub.gitHubInstallationId.toString(),
					searchQuery: "thisistheexactmatch"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return multiple repos on partial match of repoName", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const { sub, repo1, repo2, repo3 } = await createSubscriptionWithMultipleReposCloud();

		const response = {
			success: true,
			containers: [
				{
					id: repo1.repoId.toString(),
					name: repo1.repoName,
					url: repo1.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo1.updatedAt
				},
				{
					id: repo2.repoId.toString(),
					name: repo2.repoName,
					url: repo2.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo2.updatedAt
				},
				{
					id: repo3.repoId.toString(),
					name: repo3.repoName,
					url: repo3.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo3.updatedAt
				}
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/repositories/search?workspaceId=${sub.gitHubInstallationId.toString()}&searchQuery=thisis`)
			.set({
				authorization: `JWT ${await generateJwt({
					workspaceId: sub.gitHubInstallationId.toString(),
					searchQuery: "thisis"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return repos when server gitHubInstallationIds are passed in query", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const { sub, repo1, repo2, repo3 } = await createSubscriptionWithMultipleReposServer();

		const response = {
			success: true,
			containers: [
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${repo1.repoId.toString()}`,
					name: repo1.repoName,
					url: repo1.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo1.updatedAt
				},
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${repo2.repoId.toString()}`,
					name: repo2.repoName,
					url: repo2.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo2.updatedAt
				},
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${repo3.repoId.toString()}`,
					name: repo3.repoName,
					url: repo3.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo3.updatedAt
				}
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/repositories/search?workspaceId=676974687562696e7465726e616c61746c61737369616e636f6d-${sub.gitHubInstallationId.toString()}&searchQuery=thisis`)
			.set({
				authorization: `JWT ${await generateJwt({
					workspaceId: `676974687562696e7465726e616c61746c61737369616e636f6d-${sub.gitHubInstallationId.toString()}`,
					searchQuery: "thisis"
				})}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
