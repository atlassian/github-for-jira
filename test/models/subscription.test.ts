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
		await Subscription.destroy({where: {gitHubInstallationId: 123}})
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
			expect((await Subscription.findOne()).repoSyncState.numberOfSyncedRepos).toStrictEqual(3);
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
			await sub.updateSyncState({
				repos: {
					hello: {
						branchStatus: "pending"
					}
				}
			} as any);

			await sub.updateRepoSyncStateItem("hello", "branchStatus", "complete");
			expect(sub.repoSyncState?.repos?.hello?.branchStatus).toStrictEqual("complete");
			expect(sub.repoSyncState).toStrictEqual({
				repos: {
					hello: {
						branchStatus: "complete"
					}
				}
			});
		});
	});

});
