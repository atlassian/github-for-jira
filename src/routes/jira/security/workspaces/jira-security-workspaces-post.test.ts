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

	const sub3 = await Subscription.create({
		gitHubInstallationId: 3456,
		jiraHost,
		jiraClientKey: "client-key"
	});

	await RepoSyncState.create({
		subscriptionId: sub1.id,
		repoId: 1,
		repoName: "repo",
		repoOwner: "owner",
		repoFullName: "owner/repo",
		repoUrl: "https://github.com/owner/repo"
	});

	await RepoSyncState.create({
		subscriptionId: sub2.id,
		repoId: 2,
		repoName: "my-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/my-repo",
		repoUrl: "https://github.internal.atlassian.com/atlassian/my-repo"
	});

	await RepoSyncState.create({
		subscriptionId: sub3.id,
		repoId: 3,
		repoName: "repo3",
		repoOwner: "owner3",
		repoFullName: "owner3/repo3",
		repoUrl: "https://github.com/owner3/repo3"
	});

	return { sub1, sub2, sub3 };
};

describe("Workspaces Post", () => {
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
				method: "POST",
				pathname: "/jira/security/workspaces/search",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 400 status if no IDs are passed in the body", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_WORKSPACE_IDS);
			});
	});

	it("Should return an empty array if no matching subscriptions are found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const response = {
			success: true,
			workspaces: []
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["1234", "2345"]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should only return subscription once even if gitHubInstallationId is passed multiple times", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const sub1 = await Subscription.create({
			gitHubInstallationId: 1234,
			jiraHost,
			jiraClientKey: "client-key",
			avatarUrl: "http://myavatarurl"
		});

		await RepoSyncState.create({
			subscriptionId: sub1.id,
			repoId: 1,
			repoName: "repo",
			repoOwner: "owner",
			repoFullName: "owner/repo",
			repoUrl: "https://github.com/owner/repo"
		});

		const response = {
			success: true,
			workspaces: [
				{
					id: sub1.gitHubInstallationId.toString(),
					name: "owner",
					url: "https://github.com/owner",
					avatarUrl: "http://myavatarurl"
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [sub1.gitHubInstallationId, sub1.gitHubInstallationId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return the GitHub logo if there is no avatarUrl", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const sub1 = await Subscription.create({
			gitHubInstallationId: 1234,
			jiraHost,
			jiraClientKey: "client-key"
		});

		await RepoSyncState.create({
			subscriptionId: sub1.id,
			repoId: 1,
			repoName: "repo",
			repoOwner: "owner",
			repoFullName: "owner/repo",
			repoUrl: "https://github.com/owner/repo"
		});

		const response = {
			success: true,
			workspaces: [
				{
					id: sub1.gitHubInstallationId.toString(),
					name: "owner",
					url: "https://github.com/owner",
					avatarUrl: DEFAULT_AVATAR
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [sub1.gitHubInstallationId, sub1.gitHubInstallationId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all subscriptions for provided IDs (cloud and server)", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subs = await createMultipleSubscriptionsAndRepos();
		const { sub1, sub2, sub3 } = subs;

		const response = {
			success: true,
			workspaces: [
				{
					id: sub1.gitHubInstallationId.toString(),
					name: "owner",
					url: "https://github.com/owner",
					avatarUrl: "http://myavatarurl"
				},
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${sub2.gitHubInstallationId.toString()}`,
					name: "atlassian",
					url: "https://github.internal.atlassian.com/atlassian",
					avatarUrl: "http://anotheravatarurl"
				},
				{
					id: sub3.gitHubInstallationId.toString(),
					name: "owner3",
					url: "https://github.com/owner3",
					avatarUrl: DEFAULT_AVATAR
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [sub1.gitHubInstallationId, sub2.gitHubInstallationId, sub3.gitHubInstallationId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should trim ID passed for server orgs and return matching subscrptions", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const serverSubscription = await Subscription.create({
			gitHubInstallationId: 2345,
			jiraHost,
			jiraClientKey: "client-key",
			avatarUrl: "http://anotheravatarurl"
		});

		await RepoSyncState.create({
			subscriptionId: serverSubscription.id,
			repoId: 1,
			repoName: "my-server-repo",
			repoOwner: "atlassian",
			repoFullName: "atlassian/my-server-repo",
			repoUrl: "https://github.internal.atlassian.com/atlassian/my-server-repo"
		});

		const response = {
			success: true,
			workspaces: [
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${serverSubscription.gitHubInstallationId.toString()}`,
					name: "atlassian",
					url: "https://github.internal.atlassian.com/atlassian",
					avatarUrl: "http://anotheravatarurl"
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [`676974687562696e7465726e616c61746c61737369616e636f6d-${serverSubscription.gitHubInstallationId.toString()}`]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
