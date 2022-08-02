import { Subscription } from "./subscription";
import { RepoSyncState } from "./reposyncstate";

const GITHUHB_INSTALLATION_ID = 123;

describe("Subscription", () => {
	let sub: Subscription;

	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: GITHUHB_INSTALLATION_ID ,
			jiraHost,
			jiraClientKey: "myClientKey"
		});
	});

	describe("updateSyncState", () => {
		it("should return empty repos object when updating state with no repos", async () => {
			await sub.updateSyncState({
				installationId: GITHUHB_INSTALLATION_ID
			});
			expect(await RepoSyncState.toRepoJson(sub)).toEqual({
				installationId: GITHUHB_INSTALLATION_ID ,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {}
			});
		});

		it("should return same repos as what's updated", async () => {
			const repos = {
				"1": {
					repository: {
						id: 1,
						name: "bar",
						full_name: "foo/bar",
						owner: { login: "foo" },
						html_url: "foo.com",
						updated_at: new Date(123456789).toISOString()
					}
				}
			};
			await sub.updateSyncState({
				installationId: GITHUHB_INSTALLATION_ID ,
				repos
			});
			expect(await RepoSyncState.toRepoJson(sub)).toMatchObject({
				installationId: GITHUHB_INSTALLATION_ID ,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {
					"1": {
						repository: {
							id: 1,
							name: "bar",
							full_name: "foo/bar",
							owner: { login: "foo" },
							html_url: "foo.com",
							updated_at: new Date(123456789)
						}
					}
				}
			});
		});
	});

	describe("updateRepoSyncStateItem", () => {
		it("populates the value", async () => {
			await RepoSyncState.create({
				subscriptionId: sub.id,
				repoId: 1,
				repoName: "test-repo-name",
				repoOwner: "integrations",
				repoFullName: "integrations/test-repo-name",
				repoUrl: "test-repo-url"
			});
			await sub.updateRepoSyncStateItem(1, "branchStatus", "pending");
			expect(await RepoSyncState.toRepoJson(sub)).toMatchObject({
				installationId: sub.gitHubInstallationId,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {
					"1": {
						repository: {
							id: 1,
							name: "test-repo-name",
							full_name: "integrations/test-repo-name",
							owner: { login: "integrations" },
							html_url: "test-repo-url"
						},
						branchStatus: "pending"
					}
				}
			});
		});

		it("updates the value", async () => {
			const repoId = 1234;
			await sub.updateSyncState({
				repos: {
					[repoId]: {
						repository: {
							id: repoId,
							name: "bar",
							full_name: "foo/bar",
							owner: { login: "foo" },
							html_url: "foo.com",
							updated_at: new Date(123456789).toISOString()
						},
						branchStatus: "pending"
					}
				}
			});

			await sub.updateRepoSyncStateItem(repoId, "branchStatus", "complete");
			const result = await RepoSyncState.toRepoJson(sub);
			expect(result.repos?.[repoId]?.branchStatus).toBe("complete");
			expect(result).toMatchObject({
				installationId: sub.gitHubInstallationId,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {
					[repoId]: {
						repository: {
							id: repoId,
							name: "bar",
							full_name: "foo/bar",
							owner: { login: "foo" },
							html_url: "foo.com",
							updated_at: new Date(123456789)
						},
						branchStatus: "complete"
					}
				}
			});
		});
	});
	describe("Fetching subscription for mix of cloud and ghe with conflicting gitHubInstallationId", () => {
		const GHEH_GITHUB_SERVER_APP_PK_ID_1 = 10001;
		const GHEH_GITHUB_SERVER_APP_PK_ID_2 = 10002;
		beforeEach(async () => {
			await Subscription.create({
				gitHubInstallationId: GITHUHB_INSTALLATION_ID,
				gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_1"
			});
			await Subscription.create({
				gitHubInstallationId: GITHUHB_INSTALLATION_ID,
				gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_2,
				jiraHost,
				jiraClientKey: "myClientKey_ghe_2"
			});
		});
		describe("getAllFiltered", ()=>{
			it("should get for cloud record when gitHubAppId not present", async ()=>{
				const records = await Subscription.getAllFiltered(
					[GITHUHB_INSTALLATION_ID], []
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async ()=>{
				const records = await Subscription.getAllFiltered(
					[GITHUHB_INSTALLATION_ID], [], 0, undefined, undefined,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getSingleInstallation", () => {
			it("should get for cloud record when gitHubAppId not present", async ()=>{
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUHB_INSTALLATION_ID
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async ()=>{
				const record = await Subscription.getSingleInstallation(
					jiraHost,
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("findOneForGitHubInstallationId", ()=>{
			it("should get for cloud record when gitHubAppId not present", async ()=>{
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUHB_INSTALLATION_ID
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should get correct github server app", async ()=>{
				const record = await Subscription.findOneForGitHubInstallationId(
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(record).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("getAllForInstallation", () => {
			it("should only fetch cloud records when gitHubAppId not present", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUHB_INSTALLATION_ID
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: null
				}));
			});
			it("should fetch correct github server app", async () => {
				const records = await Subscription.getAllForInstallation(
					GITHUHB_INSTALLATION_ID,
					GHEH_GITHUB_SERVER_APP_PK_ID_1
				);
				expect(records.length).toBe(1);
				expect(records[0]).toEqual(expect.objectContaining({
					jiraHost,
					jiraClientKey: "myClientKey_ghe_1",
					gitHubInstallationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				}));
			});
		});
		describe("uninstall", () => {
			it("should only uninstall cloud records when gitHubAppId not present", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUHB_INSTALLATION_ID
				});
				const [results] = await Subscription.sequelize!.query('select * from "Subscriptions"');
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_1"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
			it("should uninstall correct github server app", async () => {
				await Subscription.uninstall({
					host: jiraHost,
					installationId: GITHUHB_INSTALLATION_ID,
					gitHubAppId: GHEH_GITHUB_SERVER_APP_PK_ID_1
				});
				const [results] = await Subscription.sequelize!.query('select * from "Subscriptions"');
				expect(results).toEqual([expect.objectContaining({
					jiraClientKey: "myClientKey"
				}), expect.objectContaining({
					jiraClientKey: "myClientKey_ghe_2"
				})]);
			});
		});
	});
});
