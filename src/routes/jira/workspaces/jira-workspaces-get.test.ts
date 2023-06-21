import { getLogger } from "config/logger";
import express, { Application } from "express";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { RepoSyncState } from "models/reposyncstate";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { DEFAULT_LIMIT, Workspace } from "routes/jira/workspaces/jira-workspaces-get";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

const createSubscriptions = async (jiraHost: string, numberOfSubs: number): Promise<Subscription[]> => {
	const subscriptions: Subscription[] = [];

	for (let i = 0; i < numberOfSubs; i++) {
		const installationId = i + 1; // Generate a unique installation ID
		const hashedClientKey = `key-${i + 1}`; // Generate a unique hashed client key

		const subscription: Subscription = await Subscription.install({
			host: jiraHost,
			installationId: installationId,
			hashedClientKey: hashedClientKey,
			gitHubAppId: undefined
		});

		subscriptions.push(subscription);
	}

	return subscriptions;
};

const generateUniqueRepoOwner = (): string => {
	const prefix = "repo-owner";
	const uniqueId = Math.floor(Math.random() * 1000); // Generate a random number

	return `${prefix}-${uniqueId}`;
};

const createRepositories = async (subscriptions: Subscription[]): Promise<RepoSyncState[]> => {
	const repositories: RepoSyncState[] = [];

	for (const subscription of subscriptions) {
		const repoOwner = generateUniqueRepoOwner(); // Function to generate unique repo owner

		const repository: RepoSyncState = await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 3,
			repoName: "testing-repo",
			repoOwner: repoOwner,
			repoFullName: `${repoOwner}/testing-repo`,
			repoUrl: `https://github.com/${repoOwner}/testing-repo`
		});

		repositories.push(repository);
	}

	return repositories;
};

const createRepos = async(subscriptions: Subscription[]): Promise<void> => {
	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "github-for-jira",
		repoOwner: "atlas",
		repoFullName: "atlas/github-for-jira",
		repoUrl: "http://my-internal-github.com/atlas/github-for-jira"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "another-repo",
		repoOwner: "atlas",
		repoFullName: "atlas/another-repo",
		repoUrl: "http://my-internal-github.com/atlas/another-repo"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "my-repo",
		repoOwner: "notamatch",
		repoFullName: "notamatch/my-repo",
		repoUrl: "https://github.com/notamatch/my-repo"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 4,
		repoName: "spike",
		repoOwner: "anotheratlasmatch",
		repoFullName: "anotheratlasmatch/spike",
		repoUrl: "https://github.com/atlassian/spike"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 5,
		repoName: "testing-repo",
		repoOwner: "anotheratlasmatch",
		repoFullName: "anotheratlasmatch/testing-repo",
		repoUrl: "https://github.com/anotheratlasmatch/testing-repo"
	});
};

type Response = {
	success: boolean,
	workspaces: Workspace[]
}

const generateMockResponse = (subscriptions: Subscription[], repositories: RepoSyncState[]): Response => {
	const response = {
		success: true,
		workspaces: [] as { id: string; name: string; canCreateContainer: boolean }[]
	};

	let limit: number;

	if (subscriptions.length < DEFAULT_LIMIT) {
		limit = subscriptions.length;
	} else {
		limit = DEFAULT_LIMIT;
	}

	for (let i = 0; i < limit; i++) {
		const repository = repositories[i];
		const subscription = subscriptions[i];
		const baseUrl = new URL(repository.repoUrl).origin;

		const workspace = {
			id: transformRepositoryId(subscription.gitHubInstallationId, baseUrl),
			name: repository.repoOwner,
			canCreateContainer: false
		};

		response.workspaces.push(workspace);
	}

	return response;
};

describe("Workspaces Get", () => {
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
				pathname: "/jira/workspaces/search",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 400 status if no Subscription is found for host", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=Atlas")
			.set({
				AUTHORIZATION: `JWT ${await generateJwt(
					{
						searchQuery: "Atlas"
					}
				)}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_SUBSCRIPTION);
			});
	});

	it("Should return 200 status and empty array if no connected workspaces are found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await createSubscriptions(jiraHost, 1);

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=atlas")
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "atlas"
					}
				)}`
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify([]));
				expect(res.status).toBe(200);
			});
	});

	it("Should return all orgs when no searchQuery param is provided", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 2);
		const repositories = await createRepositories(subscriptions);
		const response = generateMockResponse(subscriptions, repositories);

		await supertest(app)
			.get("/jira/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(response));
				expect(res.status).toBe(200);
			});
	});

	it("Should return all orgs that match provided searchQuery", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);
		await createRepos(subscriptions);

		const response = {
			success:true,
			workspaces: [
				{
					id: "6d79696e7465726e616c676974687562636f6d-1",
					name: "atlas",
					canCreateContainer: false
				},
				{
					id: subscriptions[2].gitHubInstallationId.toString(),
					name: "anotheratlasmatch",
					canCreateContainer: false
				}
			]
		};

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=atlas")
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "atlas"
					}
				)}`
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(response));
				expect(res.status).toBe(200);
			});
	});

	it("Should paginate workspaces when number exceeds the default limit (20)", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 21);
		const repositories = await createRepositories(subscriptions);
		const response = generateMockResponse(subscriptions, repositories);

		await supertest(app)
			.get("/jira/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(response));
				expect(res.status).toBe(200);
			});
	});
});
