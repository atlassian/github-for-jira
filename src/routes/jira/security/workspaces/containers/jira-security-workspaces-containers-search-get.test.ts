import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import express, { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Errors } from "~/src/config/errors";
import { getLogger } from "~/src/config/logger";
import { Installation } from "~/src/models/installation";
import { DEFAULT_AVATAR } from "./jira-security-workspaces-containers-post";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription } from "~/src/models/subscription";

const createMultipleSubscriptionsAndRepos = async () => {
	const sub1 = await Subscription.create({
		gitHubInstallationId: 1234,
		jiraHost,
		jiraClientKey: "client-key",
		avatarUrl: "http://myavatarurl"
	});

	const sub2 = await Subscription.create({
		gitHubInstallationId: 2345,
		jiraHost,
		jiraClientKey: "client-key",
		avatarUrl: "http://anotheravatarurl"
	});

	const repo1 = await RepoSyncState.create({
		subscriptionId: sub1.id,
		repoId: 1,
		repoName: "repo",
		repoOwner: "owner",
		repoFullName: "owner/repo",
		repoUrl: "https://github.com/owner/repo"
	});

	const repo2 = await RepoSyncState.create({
		subscriptionId: sub1.id,
		repoId: 2,
		repoName: "my-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/my-repo",
		repoUrl: "https://github.internal.atlassian.com/atlassian/my-repo"
	});

	const repo3 = await RepoSyncState.create({
		subscriptionId: sub2.id,
		repoId: 3,
		repoName: "repo3",
		repoOwner: "owner3",
		repoFullName: "owner3/repo3",
		repoUrl: "https://github.com/owner3/repo3"
	});

	return { repo1, repo2, repo3 };
};

describe("jira-security-workspaces-containers-search-get", () => {
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
				pathname: "/jira/security/workspaces/containers/search",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 400 status if no workspace ID is passed", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/security/workspaces/containers/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_WORKSPACE_ID);
			});
	});

	it("Should return all repos for workspace ID", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subs = await createMultipleSubscriptionsAndRepos();
		const { repo1, repo2 } = subs;
		const subscriptionId = repo1.subscriptionId;

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
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${repo2.repoId.toString()}`,
					name: repo2.repoName,
					url: repo2.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo2.updatedAt
				}
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/containers/search`)
			.set({
				authorization: `JWT ${await generateJwt({ workspaceId: subscriptionId })}`
			})
			.query({ workspaceId: subscriptionId })
			.expect(res => {
				expect(res.status).toBe(200);
				expect(JSON.parse(res.text).containers.length).toBe(2);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return matched repos with search query for workspace ID", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subs = await createMultipleSubscriptionsAndRepos();
		const { repo1, repo2 } = subs;
		const subscriptionId = repo1.subscriptionId;

		const response = {
			success: true,
			containers: [
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${repo2.repoId.toString()}`,
					name: repo2.repoName,
					url: repo2.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: repo2.updatedAt
				}
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/containers/search`)
			.set({
				authorization: `JWT ${await generateJwt({ workspaceId: subscriptionId, searchQuery: "my-repo" })}`
			})
			.query({ workspaceId: subscriptionId, searchQuery: "my-repo" })
			.expect(res => {
				expect(res.status).toBe(200);
				expect(JSON.parse(res.text).containers.length).toBe(1);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return an empty array if no matching workspace ID is found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await createMultipleSubscriptionsAndRepos();
		const subscriptionId = 123456; // Invalid subscription id

		const response = {
			success: true,
			containers: [
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/containers/search`)
			.set({
				authorization: `JWT ${await generateJwt({ workspaceId: subscriptionId })}`
			})
			.query({ workspaceId: subscriptionId })
			.expect(res => {
				expect(res.status).toBe(200);
				expect(JSON.parse(res.text).containers.length).toBe(0);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return an empty array if no result matches with search query", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subs = await createMultipleSubscriptionsAndRepos();
		const { repo1 } = subs;
		const subscriptionId = repo1.subscriptionId;

		const response = {
			success: true,
			containers: [
			]
		};

		await supertest(app)
			.get(`/jira/security/workspaces/containers/search`)
			.set({
				authorization: `JWT ${await generateJwt({ workspaceId: subscriptionId, searchQuery: "no-repo" })}`
			})
			.query({ workspaceId: subscriptionId, searchQuery: "no-repo" })
			.expect(res => {
				expect(res.status).toBe(200);
				expect(JSON.parse(res.text).containers.length).toBe(0);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

});