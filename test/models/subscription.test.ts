import SubscriptionClass from "../../src/models/subscription";
import { Subscription } from "../../src/models";

describe("Subscription", () => {
	let sub: SubscriptionClass = undefined;

	const getSubscription = async ():Promise<SubscriptionClass> => Subscription.findOne({ where: { gitHubInstallationId: sub.gitHubInstallationId } });

	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: Math.floor(Math.random() * 100000),
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
			const result = await getSubscription();
			expect(result.repoSyncState).toStrictEqual(REPO_SYNC_STATE);
		});

		test("sets new updatedAt on state change", async () => {
			const updatedAt = sub.updatedAt.getTime();
			await sub.updateSyncState({
				installationId: 123
			});
			const result = await getSubscription();
			expect(result.updatedAt.getTime()).toBeGreaterThan(updatedAt);
		});
	});

	describe("numberOfSyncedRepos", () => {
		test("updates when absent", async () => {
			await sub.updateSyncState({ numberOfSyncedRepos: 3 });
			expect(sub.repoSyncState.numberOfSyncedRepos).toStrictEqual(3);
			expect((await getSubscription()).repoSyncState.numberOfSyncedRepos).toStrictEqual(3);
		});

		test("updates changes when exists", async () => {
			await sub.updateSyncState({
				numberOfSyncedRepos: 123
			});
			await sub.updateSyncState({ numberOfSyncedRepos: 5 });

			expect(sub.repoSyncState.numberOfSyncedRepos).toStrictEqual(5);
			expect((await getSubscription()).repoSyncState.numberOfSyncedRepos).toStrictEqual(5);
		});
	});

	describe("update repos", () => {
		test("populates the value", async () => {
			await sub.updateSyncState({ repos: { hello: { branchStatus: "pending" } } });
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
			});

			await sub.updateSyncState({
				repos: {
					hello: {
						branchStatus: "complete"
					}
				}
			});

			expect(sub.repoSyncState.repos.hello.branchStatus).toStrictEqual("complete");
			expect(sub.repoSyncState).toStrictEqual({
				repos: {
					hello: {
						branchStatus: "complete"
					}
				}
			});
		});

		test("doesn't delete previous values", async () => {
			await sub.updateSyncState({
				repos: {
					hello: {
						branchStatus: "complete"
					}
				}
			});

			await sub.updateSyncState({
				repos: {
					hello: {
						commitStatus: "pending"
					},
					foo: {
						pullStatus: "failed"
					}
				}
			});

			expect(sub.repoSyncState).toStrictEqual({
				repos: {
					hello: {
						branchStatus: "complete",
						commitStatus: "pending"
					},
					foo: {
						pullStatus: "failed"
					}
				}
			});
		});
	});
});
