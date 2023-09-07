import { getLogger } from "config/logger";
import { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { DEFAULT_AVATAR } from "routes/jira/security/workspaces/jira-security-workspaces-post";
import { envVars } from "~/src/config/env";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

const createMultipleSubscriptionsAndRepos = async () => {
	const sub1 = await Subscription.create({
		id: 1234,
		gitHubInstallationId: "1234",
		jiraHost:envVars.APP_URL,
		jiraClientKey: "client-key",
		avatarUrl: "http://myavatarurl"
	});

	const sub2 = await Subscription.create({
		id: 2345,
		gitHubInstallationId: "2345",
		jiraHost:envVars.APP_URL,
		jiraClientKey: "client-key",
		avatarUrl: "http://anotheravatarurl"
	});

	const sub3 = await Subscription.create({
		id: 3456,
		gitHubInstallationId: "3456",
		jiraHost:envVars.APP_URL,
		jiraClientKey: "client-key"
	});
	const sub4 = await Subscription.create({
		id: 678,
		gitHubInstallationId: "678",
		jiraHost:envVars.APP_URL,
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

	return { sub1, sub2, sub3, sub4, repo1, repo2, repo3 };
};

describe("Workspaces Post", () => {
	let app: Application;
	let installation: Installation;
	let createdDbEntries;


	beforeEach(async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost
		).mockResolvedValue(true);

		createdDbEntries = await createMultipleSubscriptionsAndRepos();
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
				pathname: "/jira/security/workspaces",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 403 when the ENABLE_GITHUB_SECURITY_IN_JIRA FF is off", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost
		).mockResolvedValue(false);

		app = getFrontendApp();

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["9876", "5432"]
			})
			.expect(res => {
				expect(res.status).toBe(403);
				expect(res.text).toContain(Errors.FORBIDDEN_PATH);
			});
	});

	it("Should return a 400 status if no IDs are passed in the body", async () => {
		app = getFrontendApp();

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_WORKSPACE_IDS);
			});
	});

	it("Should return an empty array if no matching subscriptions are found", async () => {
		app = getFrontendApp();

		const response = {
			success: true,
			workspaces: []
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["9876", "5432"]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
	it("Should return a half response if a some of the entries are missin or malformed", async () => {
		app = getFrontendApp();

		const response = {
			success: true,
			workspaces: [
				{
					id: String(createdDbEntries.sub1.id),
					name: createdDbEntries.repo1.repoOwner,
					url: "https://github.com/" + (createdDbEntries.repo1.repoOwner as string),
					avatarUrl: createdDbEntries.sub1.avatarUrl
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["abc", String(createdDbEntries.sub1.id), 999]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});
	it("Should not return subscriptions without repos", async () => {
		app = getFrontendApp();

		const response = {
			success: true,
			workspaces: []
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [String(createdDbEntries.sub4.id)]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});


	it("Should only return a subscription once even if the subscription is passed multiple times", async () => {
		app = getFrontendApp();

		const response = {
			success: true,
			workspaces: [
				{
					id: String(createdDbEntries.sub1.id),
					name: createdDbEntries.repo1.repoOwner,
					url: "https://github.com/" + (createdDbEntries.repo1.repoOwner as string),
					avatarUrl: createdDbEntries.sub1.avatarUrl
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [String(createdDbEntries.sub1.id), String(createdDbEntries.sub1.id)]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return the GitHub logo if there is no avatarUrl", async () => {
		app = getFrontendApp();


		const response = {
			success: true,
			workspaces: [
				{
					id: String(createdDbEntries.sub3.id),
					name: createdDbEntries.repo3.repoOwner,
					url: "https://github.com/" + (createdDbEntries.repo3.repoOwner as string),
					avatarUrl: DEFAULT_AVATAR
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [String(createdDbEntries.sub3.id)]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all subscriptions for provided IDs", async () => {
		app = getFrontendApp();

		const response = {
			success: true,
			workspaces: [
				{
					id: String(createdDbEntries.sub1.id),
					name: createdDbEntries.repo1.repoOwner,
					url: "https://github.com/" + (createdDbEntries.repo1.repoOwner as string),
					avatarUrl: createdDbEntries.sub1.avatarUrl
				},
				{
					id: String(createdDbEntries.sub2.id),
					name: createdDbEntries.repo2.repoOwner,
					url: "https://github.internal.atlassian.com/" + (createdDbEntries.repo2.repoOwner as string),
					avatarUrl: createdDbEntries.sub2.avatarUrl
				},
				{
					id: String(createdDbEntries.sub3.id),
					name: createdDbEntries.repo3.repoOwner,
					url: "https://github.com/" + (createdDbEntries.repo3.repoOwner as string),
					avatarUrl: DEFAULT_AVATAR
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [
					String(createdDbEntries.sub1.id),
					String(createdDbEntries.sub2.id),
					String(createdDbEntries.sub3.id)
				]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

});
