import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Subscription } from "models/subscription";
import { RepoSyncState, RepoSyncStateProperties } from "models/reposyncstate";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
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

const generateMockResponse = (repositories: RepoSyncStateProperties[], totalNumberOfRepos: number, subscriptions: Subscription[]): Response => {
	const response = {
		success: true,
		repositories: [] as { id: string; name: string; workspace: { id: string, name: string } }[]
	};

	const numberOfItemsToAdd = Math.min(totalNumberOfRepos, DEFAULT_LIMIT);
	const endIndex = Math.min(numberOfItemsToAdd, repositories.length);

	for (let i = 0; i < endIndex; i++) {
		const repository = repositories[i];
		const workspace = {
			id: repository.repoId.toString(),
			name: repository.repoName,
			workspace: {
				id: subscriptions[0].gitHubInstallationId.toString(),
				name: repository.repoOwner
			}
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
				workspace: {
					id: subscriptions[0].gitHubInstallationId.toString(),
					name: repoOne.repoOwner
				}
			},
			{
				id: repoTwo.repoId.toString(),
				name: repoTwo.repoName,
				workspace: {
					id: subscriptions[0].gitHubInstallationId.toString(),
					name: repoTwo.repoOwner
				}
			},
			{
				id: repoThree.repoId.toString(),
				name: repoThree.repoName,
				workspace: {
					id: subscriptions[1].gitHubInstallationId.toString(),
					name: repoThree.repoOwner
				}
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
				workspace: {
					id: subscriptions[0].gitHubInstallationId.toString(),
					name: repoOne.repoOwner
				}
			},
			{
				id: repoTwo.repoId.toString(),
				name: repoTwo.repoName,
				workspace: {
					id: subscriptions[0].gitHubInstallationId.toString(),
					name: repoTwo.repoOwner
				}
			},
			{
				id: repoThree.repoId.toString(),
				name: repoThree.repoName,
				workspace: {
					id: subscriptions[1].gitHubInstallationId.toString(),
					name: repoThree.repoOwner
				}
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
				pathname: "/jira/workspaces/repositories/search",
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
			.get(`/jira/workspaces/repositories/search?searchQuery=new`)
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "new"
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
			.get("/jira/workspaces/repositories/search?searchQuery=atlas")
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

	it("Should return all matching repos across multiple orgs when no searchQuery (repoName) is provided", async () => {
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
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all matching repos across multiple orgs when repoName is provided", async () => {
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
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "new"
					}
				)}`
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
					workspace: {
						id: subscriptions[0].gitHubInstallationId.toString(),
						name: "owner1"
					}
				},
				{
					id: "2",
					name: "repo2",
					workspace: {
						id: subscriptions[0].gitHubInstallationId.toString(),
						name: "owner1"
					}
				}
			]
		};

		const responsePageTwo = {
			success: true,
			repositories: [
				{
					id: "676974687562696e7465726e616c61746c61737369616e636f6d-3",
					name: "repo3",
					workspace: {
						id: "676974687562696e7465726e616c61746c61737369616e636f6d-2",
						name: "owner2"
					}
				},
				{
					id: "676974687562696e7465726e616c61746c61737369616e636f6d-4",
					name: "repo4",
					workspace: {
						id: "676974687562696e7465726e616c61746c61737369616e636f6d-3",
						name: "owner3"
					}
				}
			]
		};

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo&page=1&limit=2`)
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "repo",
						page: "1",
						limit: "2"
					}
				)}`
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(responsePageOne));
			});

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo&page=2&limit=2`)
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "repo",
						page: "2",
						limit: "2"
					}
				)}`
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
		const response = generateMockResponse(repositories, totalNumberOfRepos, subscriptions);

		await supertest(app)
			.get(`/jira/workspaces/repositories/search?searchQuery=repo`)
			.set({
				authorization: `JWT ${await generateJwt(
					{
						searchQuery: "repo"
					}
				)}`
			})
			.expect((res) => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
