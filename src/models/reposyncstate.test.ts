/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from "./subscription";
import { RepoSyncState } from "./reposyncstate";
import { mocked } from "ts-jest/utils";
import { booleanFlag } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("RepoSyncState", () => {
	let sub: Subscription;
	let otherSub: Subscription;
	let repo;

	beforeEach(async () => {
		mocked(booleanFlag).mockResolvedValue(true);
		sub = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost,
			jiraClientKey: "myClientKey"
		});
		otherSub = await Subscription.create({
			gitHubInstallationId: 124,
			jiraHost,
			jiraClientKey: "myClientKey2"
		});

		repo = {
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		};

	});

	describe("countSyncedReposFromSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countSyncedReposFromSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.countSyncedReposFromSubscription(sub);
			expect(result).toEqual(0);
		});

		it("Should only count repos that are synced from specific subscription", async () => {
			await RepoSyncState.create({
				...repo,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete",
				buildStatus: "complete",
				deploymentStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				pullStatus: "pending",
				commitStatus: "complete",
				branchStatus: "complete",
				buildStatus: "complete",
				deploymentStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete",
				buildStatus: "complete",
				deploymentStatus: "complete"
			});
			const result = await RepoSyncState.countSyncedReposFromSubscription(sub);
			expect(result).toEqual(1);
		});
	});

	describe("countFailedReposFromSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countFailedReposFromSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.countFailedReposFromSubscription(sub);
			expect(result).toEqual(0);
		});

		it("Should only count repos that have a failed status from specific subscription", async () => {
			await RepoSyncState.create({
				...repo,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				pullStatus: "failed",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			const result = await RepoSyncState.countFailedReposFromSubscription(sub);
			expect(result).toEqual(1);
		});
	});

	describe("countFromSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countFromSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.countFromSubscription(sub);
			expect(result).toEqual(0);
		});

		it("Should only count repos that have a failed status from specific subscription", async () => {
			await RepoSyncState.create({
				...repo,
				pullStatus: "complete",
				commitStatus: "pending",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				pullStatus: "failed",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			const result = await RepoSyncState.countFromSubscription(sub);
			expect(result).toEqual(2);
		});
	});

	describe("findAllFromSubscription", () => {
		it("Should return no repos", async () => {
			let result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(0);
		});

		it("Should get all repos from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			const result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(1);
			expect(result[0]).toMatchObject(repo);
		});
	});

	describe("findOneFromSubscription", () => {
		it("Should return no repos", async () => {
			let result = await RepoSyncState.findOneFromSubscription(sub);
			expect(result).toBeFalsy();
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.findOneFromSubscription(sub);
			expect(result).toBeFalsy();
		});

		it("Should get one repo from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			const result = await RepoSyncState.findOneFromSubscription(sub);
			expect(result).toBeTruthy();
			expect(result).toMatchObject(repo);
		});

		it("Should get the latest updated repo from specific subscription", async () => {
			await RepoSyncState.create({
				...repo,
				repoId: 1,
				repoUpdatedAt: new Date()
			});
			await RepoSyncState.create({
				...repo,
				repoId: 2,
				repoUpdatedAt: new Date()
			});
			await RepoSyncState.create({
				...repo,
				repoId: 3,
				repoUpdatedAt: new Date(Date.now() - 3600000)
			});
			const result = await RepoSyncState.findOneFromSubscription(sub);
			expect(result).toBeTruthy();
			expect(result.repoId).toEqual(2);
		});
	});

	describe("deleteFromSubscription", () => {
		it("Delete all repos related to subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				repoId: 2
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			let repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(2);
			await RepoSyncState.deleteFromSubscription(sub);
			repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(0);
			repos = await RepoSyncState.findAll();
			expect(repos.length).toEqual(1);
		});
	});

	describe("resetSyncFromSubscription", () => {
		it("Resets sync values for all repos related to subscription", async () => {
			await RepoSyncState.create({
				...repo,
				branchStatus: "complete",
				branchCursor: "foo",
				commitStatus: "complete",
				commitCursor: "bar",
				pullStatus: "complete",
				pullCursor: "12"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id,
				branchStatus: "complete",
				branchCursor: "foo",
				commitStatus: "complete",
				commitCursor: "bar",
				pullStatus: "complete",
				pullCursor: "12"
			});
			await RepoSyncState.resetSyncFromSubscription(sub);
			const result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(1);
			expect(result[0].branchStatus).toEqual(null);
			expect(result[0].branchCursor).toEqual(null);
			expect(result[0].commitStatus).toEqual(null);
			expect(result[0].commitCursor).toEqual(null);
			expect(result[0].pullStatus).toEqual(null);
			expect(result[0].pullCursor).toEqual(null);
		});
	});

	describe("Foreign key relation with subscriptions", () => {
		it("should delete related RepoSyncStates when Subscription is deleted", async () => {

			const subToBeDeleted: Subscription  = await Subscription.create({
				gitHubInstallationId: 789,
				jiraHost,
				jiraClientKey: "myClientKey"
			});
			const repoStateThatShouldBeDeleted: RepoSyncState = await RepoSyncState.create({
				...repo,
				subscriptionId: subToBeDeleted.id
			});
			const repoStateThatShouldStay: RepoSyncState = await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});

			await subToBeDeleted.destroy();

			expect(await RepoSyncState.findByPk(repoStateThatShouldBeDeleted.id)).toBeNull();
			const remainingState: RepoSyncState = await RepoSyncState.findByPk(repoStateThatShouldStay.id);
			expect(remainingState.subscriptionId).toBe(otherSub.id);

		});
		it("should NOT delete parent Subscription when RepoSyncState is deleted", async () => {

			const stateToDelete: RepoSyncState = await RepoSyncState.create({
				...repo,
				subscriptionId: sub.id
			});

			await stateToDelete.destroy();

			const foundSub: Subscription = await Subscription.findByPk(sub.id);
			expect(foundSub.id).toBe(sub.id);
			expect(foundSub.jiraHost).toBe(sub.jiraHost);

		});
	});

	describe("Bulk upsert RepoSyncStates", () => {
		it("should do create new ones and update existing ones", async () => {

			//prepare
			await RepoSyncState.create({
				...repo,
				subscriptionId: sub.id,
				repoId: 1,
				repoFullName: "Repo One"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id,
				repoId: 2,
				repoFullName: "Repo Two"
			});

			//upsert
			const result = await RepoSyncState.bulkCreateOrUpdateByRepos(sub.id, [{
				...repo,
				repoId: 2,
				repoFullName: "Repo Two New"
			}, {
				...repo,
				repoId: 3,
				repoFullName: "Repo Three"
			}]);

			//assert
			const foundInDB = await RepoSyncState.findAll({
				where: { subscriptionId: sub.id }
			});

			expect(result).toEqual(expect.arrayContaining([
				expect.objectContaining({
					subscriptionId: sub.id,
					repoId: 2,
					repoFullName: "Repo Two New"
				}),
				expect.objectContaining({
					subscriptionId: sub.id,
					repoId: 3,
					repoFullName: "Repo Three"
				})
			]));

			expect(foundInDB).toEqual(expect.arrayContaining([
				expect.objectContaining({
					subscriptionId: sub.id,
					repoId: 1,
					repoFullName: "Repo One"
				}),
				expect.objectContaining({
					subscriptionId: sub.id,
					repoId: 2,
					repoFullName: "Repo Two New"
				}),
				expect.objectContaining({
					subscriptionId: sub.id,
					repoId: 3,
					repoFullName: "Repo Three"
				})
			]));
		});
	});
});
