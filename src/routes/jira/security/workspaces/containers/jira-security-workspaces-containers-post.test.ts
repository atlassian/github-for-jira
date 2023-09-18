import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { DEFAULT_AVATAR } from "routes/jira/security/workspaces/containers/jira-security-workspaces-containers-post";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

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

	const repo1 = await RepoSyncState.create({
		subscriptionId: sub1.id,
		repoId: 1,
		repoName: "repo",
		repoOwner: "owner",
		repoFullName: "owner/repo",
		repoUrl: "https://github.com/owner/repo"
	});

	const repo2 = await RepoSyncState.create({
		subscriptionId: sub2.id,
		repoId: 2,
		repoName: "my-repo",
		repoOwner: "atlassian",
		repoFullName: "atlassian/my-repo",
		repoUrl: "https://github.internal.atlassian.com/atlassian/my-repo"
	});

	const repo3 = await RepoSyncState.create({
		subscriptionId: sub3.id,
		repoId: 3,
		repoName: "repo3",
		repoOwner: "owner3",
		repoFullName: "owner3/repo3",
		repoUrl: "https://github.com/owner3/repo3"
	});

	return { repo1, repo2, repo3 };
};

describe("Repositories Post", () => {
	let app: Application;
	let installation: Installation;

	beforeEach(async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost
		).mockResolvedValue(true);

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
				pathname: "/jira/security/workspaces/containers",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 403 when the ENABLE_GITHUB_SECURITY_IN_JIRA FF is off", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost
		).mockResolvedValue(false);

		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/security/workspaces/containers")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["1234", "2345"]
			})
			.expect(res => {
				expect(res.status).toBe(403);
				expect(res.text).toContain(Errors.FORBIDDEN_PATH);
			});
	});

	it("Should return a 400 status if no IDs are passed in the body", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/security/workspaces/containers")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_SECURITY_CONTAINER_IDS);
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
			.post("/jira/security/workspaces/containers")
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

	it("Should only return a repo once even if the repoId is passed multiple times", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const sub = await Subscription.create({
			gitHubInstallationId: 1234,
			jiraHost,
			jiraClientKey: "client-key",
			avatarUrl: "http://myavatarurl"
		});

		const repo = await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "repo",
			repoOwner: "owner",
			repoFullName: "owner/repo",
			repoUrl: "https://github.com/owner/repo"
		});

		const { repoId, repoName, repoUrl, updatedAt } = repo;

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
			.post("/jira/security/workspaces/containers")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [repo.repoId, repo.repoId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all repos for provided IDs (cloud and server)", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const subs = await createMultipleSubscriptionsAndRepos();
		const { repo1, repo2, repo3 } = subs;

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
			.post("/jira/security/workspaces/containers")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [
					repo1.repoId.toString(),
					`676974687562696e7465726e616c61746c61737369616e636f6d-${repo2.repoId.toString()}`,
					repo3.repoId.toString()
				]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should correctly return repos for identical cloud and server IDs (once hash is trimmed)", async () => {
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
			avatarUrl: "http://serveravatarurl"
		});

		const cloudSubscription = await Subscription.create({
			gitHubInstallationId: 2345,
			jiraHost,
			jiraClientKey: "client-key",
			avatarUrl: "http://cloudavatarurl"
		});

		const serverRepo = await RepoSyncState.create({
			subscriptionId: serverSubscription.id,
			repoId: 1,
			repoName: "my-server-repo",
			repoOwner: "server",
			repoFullName: "server/my-server-repo",
			repoUrl: "https://github.internal.atlassian.com/server/my-server-repo"
		});

		const cloudRepo = await RepoSyncState.create({
			subscriptionId: cloudSubscription.id,
			repoId: 2,
			repoName: "my-cloud-repo",
			repoOwner: "cloud",
			repoFullName: "cloud/my-cloud-repo",
			repoUrl: "https://github.com/cloud/my-cloud-repo"
		});

		const response = {
			success: true,
			containers: [
				{
					id: `676974687562696e7465726e616c61746c61737369616e636f6d-${serverRepo.repoId.toString()}`,
					name: serverRepo.repoName,
					url: serverRepo.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: serverRepo.updatedAt
				},
				{
					id: cloudRepo.repoId.toString(),
					name: cloudRepo.repoName,
					url: cloudRepo.repoUrl,
					avatarUrl: DEFAULT_AVATAR,
					lastUpdatedDate: cloudRepo.updatedAt
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/containers")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [
					`676974687562696e7465726e616c61746c61737369616e636f6d-${serverRepo.repoId.toString()}`,
					cloudRepo.repoId.toString()
				]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
});
