import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Subscription } from "models/subscription";
import { RepoSyncState, RepoSyncStateProperties } from "models/reposyncstate";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { DEFAULT_LIMIT, WorkspaceRepo } from "routes/jira/workspaces/repositories/jira-workspaces-repositories-get";

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


const generateRepoId = ((): () => number => {
	let repoIdCounter = 0;

	return () => {
		repoIdCounter++;
		return repoIdCounter;
	};
})();

// Function to generate a unique repository name
const generateRepoName = (): string => {
	// Example: Generates a name with "repo-" prefix and a random number between 0 and 999
	const name = `repo-${Math.floor(Math.random() * 1000)}`;
	return name;
};

// Function to generate a unique repository owner
const generateUniqueRepoOwner = (): string => {
	const prefix = "repo-owner";
	const uniqueId = Math.floor(Math.random() * 1000); // Generate a random number

	return `${prefix}-${uniqueId}`;
};


const createMultipleRepositoriesForOneSubscription = async (subscriptionId, numberOfReposToCreate) => {
	const repositories: RepoSyncStateProperties[] = [];

	for (let i = 0; i < numberOfReposToCreate; i++) {
		const repoId = generateRepoId();
		const repoOwner = generateUniqueRepoOwner();
		const repoName = generateRepoName();

		const repo: RepoSyncStateProperties = {
			id: repoId,
			subscriptionId: subscriptionId,
			repoId,
			repoName,
			repoOwner,
			repoFullName: `${repoOwner}/${repoName}`,
			repoUrl: `github.com/${repoOwner}/${repoName}`,
			repoPushedAt: new Date(),
			updatedAt: new Date(),
			repoUpdatedAt: new Date(),
			createdAt: new Date(),
			repoCreatedAt: new Date()
		};

		await RepoSyncState.create(repo as any);
		repositories.push(repo);
	}

	return repositories;
};

type Response = {
	success: boolean,
	repositories: WorkspaceRepo[]
}

const generateMockResponse = (repositories: RepoSyncStateProperties[]): Response => {
	const response = {
		success: true,
		repositories: [] as { id: string; name: string; workspaceId: string }[]
	};

	for (let i = 0; i < DEFAULT_LIMIT; i++) {
		const repository = repositories[i];
		const workspace = {
			id: repository.repoId.toString(),
			name: repository.repoName,
			workspaceId: repository.subscriptionId.toString()
		};

		response.repositories.push(workspace);
	}

	return response;
};

describe("Workspaces Repositories Get", () => {
	let app: Application;
	let sub: Subscription;
	let installation: Installation;
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

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira-client-key"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	});

	it("Should return a 400 status if no Subscription is found for host", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
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

	// workspaceId is not provided as a query param
	it("Should return all matching repos across multiple orgs", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);
		const repoOne = await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 1,
			repoName: "new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/new-repo",
			repoUrl: "github.com/atlassian/new-repo"
		});

		const repoTwo = await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 2,
			repoName: "another-new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/another-new-repo",
			repoUrl: "github.com/atlassian/another-new-repo"
		});

		const repoThree = await RepoSyncState.create({
			subscriptionId: subscriptions[1].id,
			repoId: 3,
			repoName: "imNew",
			repoOwner: "anotherorg",
			repoFullName: "anotherorg/imnew",
			repoUrl: "github.com/anotherorg/imnew"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 4,
			repoName: "idontmatchthequery",
			repoOwner: "atlassian",
			repoFullName: "atlassian/idontmatchthequery",
			repoUrl: "github.com/atlassian/idontmatchthequery"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[1].id,
			repoId: 3,
			repoName: "neitherdoI",
			repoOwner: "anotherorg",
			repoFullName: "anotherorg/neitherdoI",
			repoUrl: "github.com/anotherorg/neitherdoI"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[2].id,
			repoId: 3,
			repoName: "anothermismatch",
			repoOwner: "org3",
			repoFullName: "org3/anothermismatch",
			repoUrl: "github.com/org3/anothermismatch"
		});

		const response = {
			success: true,
			repositories: [
				{
					id: repoOne.repoId.toString(),
					name: repoOne.repoName,
					workspaceId: repoOne.subscriptionId.toString()
				},
				{
					id: repoTwo.repoId.toString(),
					name: repoTwo.repoName,
					workspaceId: repoTwo.subscriptionId.toString()
				},
				{
					id: repoThree.repoId.toString(),
					name: repoThree.repoName,
					workspaceId: repoThree.subscriptionId.toString()
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

	// workspaceId is provided as a query param
	it("Should return all matching repos for one org", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);

		const repoOne = await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 1,
			repoName: "new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/new-repo",
			repoUrl: "github.com/atlassian/new-repo"
		});

		const repoTwo = await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 2,
			repoName: "another-new-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/another-new-repo",
			repoUrl: "github.com/atlassian/another-new-repo"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 3,
			repoName: "this-one-shouldnotmatch",
			repoOwner: "atlassian",
			repoFullName: "atlassian/shouldnotmatch",
			repoUrl: "github.com/atlassian/shouldnotmatch"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[1].id,
			repoId: 3,
			repoName: "neither-should-this-one",
			repoOwner: "another-org",
			repoFullName: "another-org/neither-should-this-one",
			repoUrl: "github.com/another-org/neither-should-this-one"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[1].id,
			repoId: 3,
			repoName: "nor-this-one",
			repoOwner: "org3",
			repoFullName: "org3/nor-this-one",
			repoUrl: "github.com/org3/nor-this-one"
		});

		const response = {
			success: true,
			repositories: [
				{
					id: repoOne.repoId.toString(),
					name: "new-repo",
					workspaceId: repoOne.subscriptionId.toString()
				},
				{
					id: repoTwo.repoId.toString(),
					name: "another-new-repo",
					workspaceId: repoOne.subscriptionId.toString()
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
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);

		await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 1,
			repoName: "repo1",
			repoOwner: "owner1",
			repoFullName: "owner1/repo1",
			repoUrl: "github.com/owner1/repo1"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[0].id,
			repoId: 2,
			repoName: "repo2",
			repoOwner: "owner1",
			repoFullName: "owner1/repo2",
			repoUrl: "github.com/owner1/repo2"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[1].id,
			repoId: 3,
			repoName: "repo3",
			repoOwner: "owner2",
			repoFullName: "owner2/repo3",
			repoUrl: "github.com/owner2/repo3"
		});

		await RepoSyncState.create({
			subscriptionId: subscriptions[2].id,
			repoId: 4,
			repoName: "repo4",
			repoOwner: "owner3",
			repoFullName: "owner3/repo4",
			repoUrl: "github.com/owner3/repo4"
		});

		const responsePage1 = {
			success: true,
			repositories: [
				{
					id: "1",
					name: "repo1",
					workspaceId: subscriptions[0].id.toString()
				},
				{
					id: "2",
					name: "repo2",
					workspaceId: subscriptions[0].id.toString()
				}
			]
		};

		const responsePage2 = {
			success: true,
			repositories: [
				{
					id: "3",
					name: "repo3",
					workspaceId: subscriptions[1].id.toString()
				},
				{
					id: "4",
					name: "repo4",
					workspaceId: subscriptions[2].id.toString()
				}
			]
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo&page=1&limit=2`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(responsePage1));
			});

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo&page=2&limit=2`)
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
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 1);
		const repositories = await createMultipleRepositoriesForOneSubscription(subscriptions[0].id, 34);
		const response = generateMockResponse(repositories);

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo`)
			.query({
				jwt
			})
			.expect((res) => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
