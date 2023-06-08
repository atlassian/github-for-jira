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
			repoUrl: `http://github.com/${repoOwner}/${repoName}`,
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

const generateMockResponse = (repositories: RepoSyncStateProperties[], totalNumberOfRepos: number): Response => {
	const response = {
		success: true,
		repositories: [] as { id: string; name: string; workspaceId: string }[]
	};

	const numberOfItemsToAdd = Math.min(totalNumberOfRepos, DEFAULT_LIMIT);
	const endIndex = Math.min(numberOfItemsToAdd, repositories.length);

	for (let i = 0; i < endIndex; i++) {
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

const createReposWhenNoQueryParamsArePassed = async (subscriptions: Subscription[]) => {
	const repoOne = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "new-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/new-repo",
		repoUrl: "https://github.com/atlassian/new-repo"
	});

	const repoTwo = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "random",
		repoOwner: "atlassian",
		repoFullName: "atlassian/random",
		repoUrl: "https://github.com/atlassian/random"
	});

	const repoThree = await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "blah",
		repoOwner: "anotherorg",
		repoFullName: "anotherorg/blah",
		repoUrl: "https://github.com/anotherorg/blah"
	});

	return {
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
};

const createReposWhenRepoNameIsPassedAsParam = async (subscriptions: Subscription[]) => {
	const repoOne = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "new-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/new-repo",
		repoUrl: "https://github.com/atlassian/new-repo"
	});

	const repoTwo = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "another-new-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/another-new-repo",
		repoUrl: "https://github.com/atlassian/another-new-repo"
	});

	const repoThree = await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "imNew",
		repoOwner: "anotherorg",
		repoFullName: "anotherorg/imNew",
		repoUrl: "https://github.com/anotherorg/imNew"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 4,
		repoName: "idontmatchthequery",
		repoOwner: "atlassian",
		repoFullName: "atlassian/idontmatchthequery",
		repoUrl: "https://github.com/atlassian/idontmatchthequery"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "neitherdoI",
		repoOwner: "anotherorg",
		repoFullName: "anotherorg/neitherdoI",
		repoUrl: "https://github.com/anotherorg/neitherdoI"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 3,
		repoName: "anothermismatch",
		repoOwner: "org3",
		repoFullName: "org3/anothermismatch",
		repoUrl: "https://github.com/org3/anothermismatch"
	});

	return {
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
};

const createReposWhenRepoNameAndWorkspaceIdPassedAsParams = async (subscriptions: Subscription[]) => {
	const repoOne = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "new-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/new-repo",
		repoUrl: "http://github.internal.atlassian.com/atlassian/new-repo"
	});

	const repoTwo = await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "another-new-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/another-new-repo",
		repoUrl: "http://github.internal.atlassian.com/atlassian/another-new-repo"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 3,
		repoName: "this-one-shouldnotmatch",
		repoOwner: "atlassian",
		repoFullName: "atlassian/shouldnotmatch",
		repoUrl: "http://github.internal.atlassian.com/atlassian/shouldnotmatch"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "neither-should-this-one",
		repoOwner: "another-org",
		repoFullName: "another-org/neither-should-this-one",
		repoUrl: "http://github.internal.atlassian.com/another-org/neither-should-this-one"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "nor-this-one",
		repoOwner: "org3",
		repoFullName: "org3/nor-this-one",
		repoUrl: "http://github.internal.atlassian.com/org3/nor-this-one"
	});

	return {
		success: true,
		repositories: [
			{
				id: "676974687562696e7465726e616c61746c61737369616e636f6d-1",
				name: "new-repo",
				workspaceId: repoOne.subscriptionId.toString()
			},
			{
				id: "676974687562696e7465726e616c61746c61737369616e636f6d-2",
				name: "another-new-repo",
				workspaceId: repoTwo.subscriptionId.toString()
			}
		]
	};
};

const createReposWhenPageAndLimitArePassedAsParams = async (subscriptions: Subscription[]) => {
	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "repo1",
		repoOwner: "owner1",
		repoFullName: "owner1/repo1",
		repoUrl: "https://github.com/owner1/repo1"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "repo2",
		repoOwner: "owner1",
		repoFullName: "owner1/repo2",
		repoUrl: "https://github.com/owner1/repo2"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "repo3",
		repoOwner: "owner2",
		repoFullName: "owner2/repo3",
		repoUrl: "http://github.internal.atlassian.com/owner2/repo3"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 4,
		repoName: "repo4",
		repoOwner: "owner3",
		repoFullName: "owner3/repo4",
		repoUrl: "http://github.internal.atlassian.com/owner3/repo4"
	});
};

describe("Workspaces Repositories Get", () => {
	let app: Application;
	let installation: Installation;
	let jwt: string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
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
			.get(`/jira/workspaces/repositories/search?searchQuery=new`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_SUBSCRIPTION);
			});
	});

	it("Should return all matching repos across multiple orgs when both workspaceId and repoName are not provided", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 2);
		const response = await createReposWhenNoQueryParamsArePassed(subscriptions);

		await supertest(app)
			.get(`/jira/workspaces/repositories/search`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all matching repos across multiple orgs when repoName is provided but workspaceId is not", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);
		const response = await createReposWhenRepoNameIsPassedAsParam(subscriptions);

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

	it("Should return all matching repos for one org based on workspaceId", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subscriptions = await createSubscriptions(jiraHost, 3);
		const response = await createReposWhenRepoNameAndWorkspaceIdPassedAsParams(subscriptions);

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?workspaceId=${subscriptions[0].id}&searchQuery=new`)
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
		await createReposWhenPageAndLimitArePassedAsParams(subscriptions);

		const responsePageOne = {
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

		const responsePageTwo = {
			success: true,
			repositories: [
				{
					id: "676974687562696e7465726e616c61746c61737369616e636f6d-3",
					name: "repo3",
					workspaceId: subscriptions[1].id.toString()
				},
				{
					id: "676974687562696e7465726e616c61746c61737369616e636f6d-4",
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
				expect(res.text).toContain(JSON.stringify(responsePageOne));
			});

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo&page=2&limit=2`)
			.query({
				jwt
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(responsePageTwo));
			});
	});

	it("Should return paginated repositories when number of repositories exceeds the default limit", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const totalNumberOfRepos = 34;
		const subscriptions = await createSubscriptions(jiraHost, 1);
		const repositories = await createMultipleRepositoriesForOneSubscription(subscriptions[0].id, totalNumberOfRepos);
		const response = generateMockResponse(repositories, totalNumberOfRepos);

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
