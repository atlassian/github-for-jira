import SubscriptionClass from "../../src/models/subscription";
import { Subscription } from "../../src/models";

describe("Subscription", () => {
	let sub: SubscriptionClass;

	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost: "http://blah.com",
			jiraClientKey: "myClientKey",
			repoSyncState: undefined,
			updatedAt: new Date(),
			createdAt: new Date()
		});
	});

	afterEach(async () => {
		await Subscription.destroy({ truncate: true });
	});

	describe("updateSyncState", () => {
		test("updates the state", async () => {
			const REPO_SYNC_STATE = {
				installationId: 123
			};
			await sub.updateSyncState(REPO_SYNC_STATE);
			expect((await Subscription.findOne()).repoSyncState).toStrictEqual(REPO_SYNC_STATE);
		});
	});

	describe("updateNumberOfSyncedRepos", () => {
		test("updates when absent", async () => {
			await sub.updateNumberOfSyncedRepos(3);
			expect(sub.repoSyncState?.numberOfSyncedRepos).toStrictEqual(3);
			expect((await Subscription.findOne()).repoSyncState.numberOfSyncedRepos).toStrictEqual(3);
		});

		test("updates changes when exists", async () => {
			await sub.updateSyncState({
				numberOfSyncedRepos: 123
			});
			await sub.updateNumberOfSyncedRepos(3);

			expect(sub.repoSyncState?.numberOfSyncedRepos).toStrictEqual(3);
			await sub.reload();
			expect(sub.repoSyncState?.numberOfSyncedRepos).toStrictEqual(3);
		});

		test("Should update the number of synced repos in column as well as JSON", async () => {
			const num = 100;
			await sub.updateNumberOfSyncedRepos(num);
			expect(sub.repoSyncState?.numberOfSyncedRepos).toEqual(num);
			expect(sub.numberOfSyncedRepos).toEqual(num);
		});
	});

	describe("updateRepoSyncStateItem", () => {
		test("populates the value", async () => {
			await sub.updateRepoSyncStateItem("hello", "branchStatus", "pending");
			expect(sub.repoSyncState).toStrictEqual({
				repos: {
					hello: {
						branchStatus: "pending"
					}
				}
			});
		});

		test("updates the value", async () => {
			const repoId = "1234";
			await sub.updateSyncState({
				repos: {
					[repoId]: {
						branchStatus: "pending"
					}
				}
			} as any);

			await sub.updateRepoSyncStateItem(repoId, "branchStatus", "complete");
			expect(sub.repoSyncState?.repos?.[repoId]?.branchStatus).toStrictEqual("complete");
			expect(sub.repoSyncState).toStrictEqual({
				repos: {
					[repoId]: {
						branchStatus: "complete"
					}
				}
			});
		});
	});

});
