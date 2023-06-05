import { getLogger } from "config/logger";
import express, { Application } from "express";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { RepoSyncState } from "models/reposyncstate";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { DEFAULT_LIMIT, Workspace } from "routes/jira/workspaces/jira-workspaces-get";
import { createSubscriptions } from "test/utils/create-subscriptions";
import { createRepositories } from "test/utils/create-repositories";

const createRepos = async(subscriptions: Subscription[]): Promise<void> => {
	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 1,
		repoName: "github-for-jira",
		repoOwner: "atlas",
		repoFullName: "atlas/github-for-jira",
		repoUrl: "github.com/atlas/github-for-jira"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[0].id,
		repoId: 2,
		repoName: "another-repo",
		repoOwner: "atlas",
		repoFullName: "atlas/another-repo",
		repoUrl: "github.com/atlas/another-repo"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[1].id,
		repoId: 3,
		repoName: "my-repo",
		repoOwner: "notamatch",
		repoFullName: "notamatch/my-repo",
		repoUrl: "github.com/notamatch/my-repo"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 4,
		repoName: "spike",
		repoOwner: "anotheratlasmatch",
		repoFullName: "anotheratlasmatch/spike",
		repoUrl: "github.com/atlassian/spike"
	});

	await RepoSyncState.create({
		subscriptionId: subscriptions[2].id,
		repoId: 5,
		repoName: "testing-repo",
		repoOwner: "anotheratlasmatch",
		repoFullName: "anotheratlasmatch/testing-repo",
		repoUrl: "github.com/anotheratlasmatch/testing-repo"
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
		const subscription = subscriptions[i];
		const repository = repositories[i];
		const workspace = {
			id: subscription.id.toString(),
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
			.get("/jira/workspaces/search?searchQuery=Atlas")
			.query({
				jwt
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
			.query({
				jwt
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
			.query({
				jwt
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
					id: subscriptions[0].id.toString(),
					name: "atlas",
					canCreateContainer: false
				},
				{
					id: subscriptions[2].id.toString(),
					name: "anotheratlasmatch",
					canCreateContainer: false
				}
			]
		};

		await supertest(app)
			.get("/jira/workspaces/search?searchQuery=atlas")
			.query({
				jwt
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
			.query({
				jwt
			})
			.expect(res => {
				expect(res.text).toContain(JSON.stringify(response));
				expect(res.status).toBe(200);
			});
	});
});
