import { gitHubAppIdCondition, Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

const GITHUB_INSTALLATION_ID = 123;

// TODO: add rest of tests, use jira issue ARC-1580
describe("Subscription", () => {

	describe("Fetching subscription for mix of cloud and ghe with conflicting gitHubInstallationId", () => {
		const GHES_GITHUB_SERVER_APP_PK_ID_1 = 10001;
		const GHES_GITHUB_SERVER_APP_PK_ID_2 = 10002;
		beforeEach(async () => {
			const sub0 = await Subscription.create({
				gitHubInstallationId: GITHUB_INSTALLATION_ID,
				jiraHost,
				jiraClientKey: "myClientKey"
			});
			const sub1 = await Subscription.create({
				gitHubInstallationId: GITHUB_INSTALLATION_ID,
				gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_1"
			});
			const sub2 = await Subscription.create({
				gitHubInstallationId: GITHUB_INSTALLATION_ID,
				gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_2,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_2"
			});
			await RepoSyncState.create({
				subscriptionId: sub0.id,
				repoId: 1,
				repoName: "repo-0",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira"
			});
			await RepoSyncState.create({
				subscriptionId: sub0.id,
				repoId: 1,
				repoName: "repo-0-0",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira"
			});
			await RepoSyncState.create({
				subscriptionId: sub1.id,
				repoId: 2,
				repoName: "repo-1",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira"
			});
			await RepoSyncState.create({
				subscriptionId: sub2.id,
				repoId: 3,
				repoName: "repo-2",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira"
			});
		});
		describe("getAllForHost", () => {
			it("should get all cloud and server records when only jiraHost is passed", async () => {
				const records = await Subscription.getAllForHost(jiraHost);
				expect(records.length).toBe(3);
				expect(records[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					jiraHost,
					jiraClientKey: "myClientKey"
				}));
				expect(records[1]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1"
				}));
				expect(records[2]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_2,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_2"
				}));
			});
			it("should get all server records when jiraHost is passed with gitHubAppid", async () => {
				const record1 = await Subscription.getAllForHost(jiraHost, GHES_GITHUB_SERVER_APP_PK_ID_1);
				expect(record1.length).toBe(1);
				expect(record1[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1"
				}));

				const record2 = await Subscription.getAllForHost(jiraHost, GHES_GITHUB_SERVER_APP_PK_ID_2);
				expect(record2.length).toBe(1);
				expect(record2[0]).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_2,
					jiraHost,
					jiraClientKey: "myClientKey_ghe_2"
				}));
			});

		});
		describe("getAllFiltered", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const records = await Subscription.getAllFiltered(
					undefined, [GITHUB_INSTALLATION_ID], []
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const records = await Subscription.getAllFiltered(
					GHES_GITHUB_SERVER_APP_PK_ID_1, [GITHUB_INSTALLATION_ID], [], 0, undefined, undefined
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getSingleInstallation", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUB_INSTALLATION_ID,
					undefined
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUB_INSTALLATION_ID,
					GHES_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("findOneForGitHubInstallationId", () => {
			it("should get for cloud record when gitHubAppId not present", async () => {
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUB_INSTALLATION_ID, undefined
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async () => {
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUB_INSTALLATION_ID,
					GHES_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getAllForInstallation", () => {
			it("should only fetch cloud records when gitHubAppId not present", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUB_INSTALLATION_ID, undefined
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should fetch correct github server app", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUB_INSTALLATION_ID,
					GHES_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("uninstall", () => {
			it("should only uninstall cloud records when gitHubAppId not present", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: undefined
				});
				const [results] = await Subscription.sequelize!.query("select * from \"Subscriptions\"");
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_1"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
			it("should uninstall correct github server app", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUB_INSTALLATION_ID,
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID_1
				});
				const [results] = await Subscription.sequelize!.query("select * from \"Subscriptions\"");
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
		});
		describe("findForRepoNameAndOwner", () => {
			it("should fetch the subscription for the given repo name and owner", async () => {
				const repo0Sub = await Subscription.findForRepoNameAndOwner("repo-0", "atlassian", jiraHost, false);
				const repo00Sub = await Subscription.findForRepoNameAndOwner("repo-0-0", "atlassian", jiraHost, false);
				const repo1Sub = await Subscription.findForRepoNameAndOwner("repo-1", "atlassian", jiraHost, true);
				const repo2Sub = await Subscription.findForRepoNameAndOwner("repo-2", "atlassian", jiraHost, true);
				expect(repo0Sub?.jiraClientKey).toBe("myClientKey");
				expect(repo00Sub?.jiraClientKey).toBe("myClientKey");
				expect(repo1Sub?.jiraClientKey).toBe("myClientKey_ghe_1");
				expect(repo2Sub?.jiraClientKey).toBe("myClientKey_ghe_2");
			});
			it("should return undefined for unknown given repo name and owner", async () => {
				const repoRandomSub = await Subscription.findForRepoNameAndOwner("repo-unknown", "atlassian", jiraHost, false);
				const repoRandom2Sub = await Subscription.findForRepoNameAndOwner("repo-2", "atlassian2", jiraHost, true);
				expect(repoRandomSub?.jiraClientKey).toBe(undefined);
				expect(repoRandom2Sub?.jiraClientKey).toBe(undefined);
			});
		});
	});

	describe("install", () => {
		describe("cloud", () => {
			let cloudSub =
			beforeEach(async ()=>{
				cloudSub = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: undefined,
					hashedClientKey: "cloud_client_key"
				});
			});
			it("should install subscription", async () => {
				const found = await Subscription.findByPk(cloudSub.id);
				expect(found).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					jiraHost: "http://normal-cloud.atlassian.net",
					gitHubAppId: null,
					jiraClientKey: "cloud_client_key",
					plainClientKey: null
				}));
			});
			it("should override existing record if found", async () => {
				//install another payload with same value
				const cloudSub2 = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: undefined,
					hashedClientKey: "cloud_client_key",
					avatarUrl: "https://some-another-avatar-url"
				});
				expect(cloudSub.id).toBe(cloudSub2.id);
				expect((await Subscription.findAll()).length).toBe(1);
			});
		});
		describe("ghes", ()=>{
			const GHES_GITHUB_SERVER_APP_PK_ID = 10000;
			let cloudSub;
			beforeEach(async ()=>{
				cloudSub = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: undefined,
					hashedClientKey: "cloud_client_key"
				});
			});
			it("should install a new sub even with same gitHubInstallationId", async ()=>{
				const ghesSub = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID,
					hashedClientKey: "cloud_client_key"
				});
				expect(cloudSub.id).not.toBe(ghesSub.id);
				expect((await Subscription.findAll()).length).toBe(2);
				expect(ghesSub).toEqual(expect.objectContaining({
					gitHubInstallationId: GITHUB_INSTALLATION_ID,
					jiraHost: "http://normal-cloud.atlassian.net",
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID,
					jiraClientKey: "cloud_client_key",
					plainClientKey: null
				}));
			});
			it("should override existing ghes sub when found", async ()=>{
				const ghesSub1 = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID,
					hashedClientKey: "cloud_client_key"
				});
				const ghesSub2 = await Subscription.install({
					installationId: GITHUB_INSTALLATION_ID,
					host: "http://normal-cloud.atlassian.net",
					gitHubAppId: GHES_GITHUB_SERVER_APP_PK_ID,
					hashedClientKey: "cloud_client_key"
				});
				expect(ghesSub1.id).toBe(ghesSub2.id);
				expect((await Subscription.findAll()).length).toBe(2);
			});
		});
	});

	describe("gitHubAppIdCondition", () => {
		it("should return server condition have gitHubAppId", async () => {
			expect(gitHubAppIdCondition(true)).toBe("AND s.\"gitHubAppId\" IS NOT NULL");
		});
		it("should return cloud condition have null gitHubAppId", async () => {
			expect(gitHubAppIdCondition(false)).toBe("AND s.\"gitHubAppId\" IS NULL");
		});
	});

});
