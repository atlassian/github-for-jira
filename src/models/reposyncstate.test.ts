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

	describe("countFullySyncedReposForSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countFullySyncedReposForSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.countFullySyncedReposForSubscription(sub);
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
			const result = await RepoSyncState.countFullySyncedReposForSubscription(sub);
			expect(result).toEqual(1);
		});
	});

	describe("countFailedSyncedReposForSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countFailedSyncedReposForSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.countFailedSyncedReposForSubscription(sub);
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
			const result = await RepoSyncState.countFailedSyncedReposForSubscription(sub);
			expect(result).toEqual(1);
		});
	});

	describe("findAllFromSubscription", () => {
		it("Should return no repos", async () => {
			let result = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
			expect(result.length).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			result = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
			expect(result.length).toEqual(0);
		});

		it("Should get all repos from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: otherSub.id
			});
			const result = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
			expect(result.length).toEqual(1);
			expect(result[0]).toMatchObject(repo);
		});

		it("Should do pagination properly and consistently", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				repoFullName: "anotherOne"
			});
			const page1 = await RepoSyncState.findAllFromSubscription(sub, 1, 0, [["id", "DESC"]]);
			const page2 = await RepoSyncState.findAllFromSubscription(sub, 1, 1, [["id", "DESC"]]);
			const page3 = await RepoSyncState.findAllFromSubscription(sub, 1, 2, [["id", "DESC"]]);
			expect(page1.length).toEqual(1);
			expect(page1[0]).toMatchObject({
				...repo,
				repoFullName: "anotherOne"
			});

			expect(page2.length).toEqual(1);
			expect(page2[0]).toMatchObject(repo);

			expect(page3.length).toEqual(0);
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
			expect(result?.repoId).toEqual(2);
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
			let repos = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
			expect(repos.length).toEqual(2);
			await RepoSyncState.deleteFromSubscription(sub);
			repos = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
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
			const result = await RepoSyncState.findAllFromSubscription(sub, 100, 0, [["id", "DESC"]]);
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
			const remainingState: RepoSyncState | null = await RepoSyncState.findByPk(repoStateThatShouldStay.id);
			expect(remainingState?.subscriptionId).toBe(otherSub.id);

		});

		it("should NOT delete parent Subscription when RepoSyncState is deleted", async () => {

			const stateToDelete: RepoSyncState = await RepoSyncState.create({
				...repo,
				subscriptionId: sub.id
			});

			await stateToDelete.destroy();

			const foundSub: Subscription | null = await Subscription.findByPk(sub.id);
			expect(foundSub?.id).toBe(sub.id);
			expect(foundSub?.jiraHost).toBe(sub.jiraHost);

		});
	});

	describe("findRepositoriesBySubscriptionIdsAndRepoName", () => {
		it("Should return repositories matching the subscription ID and repo name", async () => {
			const repo1 = {
				...repo,
				subscriptionId: sub.id,
				repoName: "github-for-jira"
			};

			const repo2 = {
				...repo,
				subscriptionId: otherSub.id,
				repoName: "atlassian-connect-express"
			};

			await RepoSyncState.create(repo1);
			await RepoSyncState.create(repo2);

			const result = await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(jiraHost, sub.id, 1, 10, "github-for-jira");

			expect(result).toHaveLength(1);
			expect(result![0]).toMatchObject(repo1);
		});

		it("Should return repositories matching the subscription ID when repo name is not provided", async () => {
			const repo1 = {
				...repo,
				subscriptionId: sub.id,
				repoName: "github-for-jira"
			};

			const repo2 = {
				...repo,
				subscriptionId: otherSub.id,
				repoName: "atlassian-connect-express"
			};

			await RepoSyncState.create(repo1);
			await RepoSyncState.create(repo2);

			const result = await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(jiraHost, sub.id, 1, 10);

			expect(result).toHaveLength(1);
			expect(result![0]).toMatchObject(repo1);
		});

		it("Should return empty array when no repositories match the subscription ID and repo name", async () => {
			const repo1 = {
				...repo,
				subscriptionId: sub.id,
				repoName: "github-for-jira"
			};

			const repo2 = {
				...repo,
				subscriptionId: otherSub.id,
				repoName: "atlassian-connect-express"
			};

			await RepoSyncState.create(repo1);
			await RepoSyncState.create(repo2);

			const result = await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(jiraHost, sub.id, 1, 10, "non-existing-repo");

			expect(result).toHaveLength(0);
		});

		it("Should return repositories matching multiple subscription IDs", async () => {
			const repo1 = {
				...repo,
				subscriptionId: sub.id,
				repoName: "github-for-jira"
			};

			const repo2 = {
				...repo,
				subscriptionId: otherSub.id,
				repoName: "atlassian-connect-express"
			};

			await RepoSyncState.create(repo1);
			await RepoSyncState.create(repo2);

			const result = await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(
				jiraHost,
				[sub.id, otherSub.id],
				1,
				10
			);

			expect(result).toHaveLength(2);
			expect(result).toEqual(
				expect.arrayContaining([expect.objectContaining(repo1), expect.objectContaining(repo2)])
			);
		});
	});

	describe("findRepoByRepoIdAndJiraHost", () => {
		it("Should return null if no repository matches the repoId and jiraHost", async () => {
			const result = await RepoSyncState.findRepoByRepoIdAndJiraHost(2, "example.com");

			expect(result).toBeNull();
		});

		it("Should return the repository if a matching repoId and jiraHost are found", async () => {
			const repo = {
				subscriptionId: sub.id,
				repoId: 1,
				repoName: "github-for-jira",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira"
			};

			await RepoSyncState.create(repo);

			const result = await RepoSyncState.findRepoByRepoIdAndJiraHost(repo.repoId, jiraHost);

			expect(result).toMatchObject(repo);
		});
	});

	describe("findAllRepoOwners", () => {
		it("should return empty list when no orgs were connected", async () => {
			const result = await RepoSyncState.findAllRepoOwners(sub);
			expect(result).toStrictEqual(new Set([]));
		});

		it("should return connected orgs", async () => {
			await RepoSyncState.create(repo);

			const anotherRepo = {
				...repo,
				repoOwner: "anotherOne"
			};
			await RepoSyncState.create(anotherRepo);

			const result = await RepoSyncState.findAllRepoOwners(sub);
			expect(result).toStrictEqual(new Set(["atlassian", "anotherOne"]));
		});

		it("should dedup records", async () => {
			await RepoSyncState.create(repo);

			const anotherRepo = {
				...repo,
				repoName: "github-for-jira"
			};
			await RepoSyncState.create(anotherRepo);

			const result = await RepoSyncState.findAllRepoOwners(sub);
			expect(result).toStrictEqual(new Set(["atlassian"]));
		});
	});

	describe("findOneForRepoUrlAndRepoIdAndJiraHost", () => {
		it("Should return null if no repository matches the repoUrl, repoId and JiraHost", async () => {
			await RepoSyncState.create(repo);

			expect(
				await RepoSyncState.findOneForRepoUrlAndRepoIdAndJiraHost(
					"github.com/different/repo",
					repo.repoId,
					sub.jiraHost
				)
			).toBeNull();

			expect(
				await RepoSyncState.findOneForRepoUrlAndRepoIdAndJiraHost(
					repo.repoUrl,
					99999,
					sub.jiraHost
				)
			).toBeNull();

			expect(
				await RepoSyncState.findOneForRepoUrlAndRepoIdAndJiraHost(
					repo.repoUrl,
					repo.repoId,
					"differenthost.atlassian.net"
				)
			).toBeNull();
		});

		it("Should return the repo if a repo matches the repoUrl, repoId and jiraHost", async () => {
			await RepoSyncState.create(repo);

			const result = await RepoSyncState.findOneForRepoUrlAndRepoIdAndJiraHost(
				repo.repoUrl,
				repo.repoId,
				sub.jiraHost
			);

			expect(result).toMatchObject(repo);
		});
	});
});
