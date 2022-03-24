import SubscriptionClass from "./subscription";
import { RepoSyncState, Subscription } from "./models";

describe("Subscription", () => {
	let sub: SubscriptionClass;

	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost,
			jiraClientKey: "myClientKey"
		});
	});

	describe("updateSyncState", () => {
		it("should return empty repos object when updating state with no repos", async () => {
			await sub.updateSyncState({
				installationId: 123
			});
			expect(await RepoSyncState.toRepoJson(sub)).toEqual({
				installationId: 123,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {}
			});
		});

		it("should return same repos as what's updated", async () => {
			const repos = {
				"1": {
					repository: {
						id: "1",
						name: "bar",
						full_name: "foo/bar",
						owner: { login: "foo" },
						html_url: "foo.com",
						updated_at: 123456789
					}
				}
			};
			await sub.updateSyncState({
				installationId: 123,
				repos
			});
			expect(await RepoSyncState.toRepoJson(sub)).toMatchObject({
				installationId: 123,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {
					"1": {
						repository: {
							id: "1",
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
			await sub.updateRepoSyncStateItem("1", "branchStatus", "pending");
			expect(await RepoSyncState.toRepoJson(sub)).toMatchObject({
				installationId: sub.gitHubInstallationId,
				jiraHost,
				numberOfSyncedRepos: 0,
				repos: {
					"1": {
						repository: {
							id: "1",
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
			const repoId = "1234";
			await sub.updateSyncState({
				repos: {
					[repoId]: {
						repository: {
							id: repoId,
							name: "bar",
							full_name: "foo/bar",
							owner: { login: "foo" },
							html_url: "foo.com",
							updated_at: 123456789
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
});
