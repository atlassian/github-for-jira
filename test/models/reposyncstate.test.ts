/* eslint-disable @typescript-eslint/no-explicit-any */
import SubscriptionClass, { RepositoryData } from "../../src/models/subscription";
import { RepoSyncState, Subscription } from "../../src/models";
import { mocked } from "ts-jest/utils";
import { booleanFlag } from "../../src/config/feature-flags";

jest.mock("../../src/config/feature-flags");

describe("RepoSyncState", () => {
	let sub: SubscriptionClass;
	let repo;

	beforeEach(async () => {
		mocked(booleanFlag).mockResolvedValue(true);
		sub = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost,
			jiraClientKey: "myClientKey",
			repoSyncState: undefined
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

	afterEach(async () => {
		await Promise.all([
			RepoSyncState.destroy({ truncate: true }),
			sub.destroy()
		]);
	});

	describe("countSyncedReposFromSubscription", () => {
		it("Should count no repos", async () => {
			let result = await RepoSyncState.countSyncedReposFromSubscription(sub);
			expect(result).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			result = await RepoSyncState.countSyncedReposFromSubscription(sub);
			expect(result).toEqual(0);
		});

		it("Should only count repos that are synced from specific subscription", async () => {
			await RepoSyncState.create({
				...repo,
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				pullStatus: "pending",
				commitStatus: "complete",
				branchStatus: "complete"
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000),
				pullStatus: "complete",
				commitStatus: "complete",
				branchStatus: "complete"
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
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
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
				subscriptionId: Math.round(Math.random() * 10000),
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
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
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
				subscriptionId: Math.round(Math.random() * 10000),
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
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(0);
		});

		it("Should get all repos from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
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
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			result = await RepoSyncState.findOneFromSubscription(sub);
			expect(result).toBeFalsy();
		});

		it("Should get one repo from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
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
				subscriptionId: Math.round(Math.random() * 10000)
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
				subscriptionId: Math.round(Math.random() * 10000),
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

	describe("updateFromRepoJson", () => {
		const json: RepositoryData = {
			pullStatus: "complete",
			branchStatus: "pending",
			commitStatus: "failed",
			lastBranchCursor: "1",
			lastCommitCursor: "2",
			lastPullCursor: 3,
			repository: {
				id: "2",
				name: "bar",
				full_name: "foo/bar",
				html_url: "github.com/foo/bar",
				owner: {
					login: "foo"
				},
				updated_at: Date.now()
			}
		};

		it("Should create a new row in table when setting JSON with repos", async () => {
			await RepoSyncState.updateFromRepoJson(sub, {
				numberOfSyncedRepos: 2,
				jiraHost: sub.jiraHost,
				installationId: sub.gitHubInstallationId,
				repos: {
					"2": json
				}
			});
			const result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(1);
			const data = result[0];
			expect(data.repoId).toEqual(Number(json.repository?.id));
			expect(data.repoName).toEqual(json.repository?.name);
			expect(data.repoOwner).toEqual(json.repository?.owner.login);
			expect(data.repoFullName).toEqual(json.repository?.full_name);
			expect(data.repoUpdatedAt?.getTime()).toEqual(json.repository?.updated_at);
			expect(data.repoUrl).toEqual(json.repository?.html_url);
			expect(data.branchStatus).toEqual(json.branchStatus);
			expect(data.branchCursor).toEqual(json.lastBranchCursor);
			expect(data.commitStatus).toEqual(json.commitStatus);
			expect(data.commitCursor).toEqual(json.lastCommitCursor);
			expect(data.pullStatus).toEqual(json.pullStatus);
			expect(data.pullCursor).toEqual(json.lastPullCursor?.toString());
		});

		it("Should remove a row in the table when JSON doesn't have it anymore", async () => {
			await RepoSyncState.create({
				...repo,
				repoId: 1
			});
			await RepoSyncState.create({
				...repo,
				repoId: 2
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});

			let result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(2);
			await RepoSyncState.updateFromRepoJson(sub, {
				numberOfSyncedRepos: 1,
				jiraHost: sub.jiraHost,
				installationId: sub.gitHubInstallationId,
				repos: {
					"2": json
				}
			});
			result = await RepoSyncState.findAllFromSubscription(sub);
			expect(result.length).toEqual(1);
			expect(result[0].repoId).toEqual(2);
			result = await RepoSyncState.findAll();
			expect(result.length).toEqual(2);
		});
	});

	describe("toRepoJson", () => {
		it("Should return the RepoSyncStateObject JSON for this subscription", async () => {
			await RepoSyncState.create({
				...repo,
				repoId: 1,
				branchStatus: "complete",
				branchCursor: "foo",
				commitStatus: "complete",
				commitCursor: "bar",
				pullStatus: "complete",
				pullCursor: "12",
				repoUpdatedAt: new Date(0)
			});
			await RepoSyncState.create({
				...repo,
				repoId: 2,
				branchStatus: "failed",
				repoUpdatedAt: new Date(0)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});

			const result = await RepoSyncState.toRepoJson(sub);
			expect(result).toMatchObject({
				installationId: 123,
				jiraHost,
				numberOfSyncedRepos: 1,
				repos: {
					"1": {
						pullStatus: "complete",
						branchStatus: "complete",
						commitStatus: "complete",
						lastBranchCursor: "foo",
						lastCommitCursor: "bar",
						lastPullCursor: 12,
						repository: {
							id: "1",
							name: "github-for-jira",
							full_name: "atlassian/github-for-jira",
							html_url: "github.com/atlassian/github-for-jira",
							owner: {
								login: "atlassian"
							},
							updated_at: new Date(0)
						}
					},
					"2": {
						branchStatus: "failed",
						repository: {
							id: "2",
							name: "github-for-jira",
							full_name: "atlassian/github-for-jira",
							html_url: "github.com/atlassian/github-for-jira",
							owner: {
								login: "atlassian"
							},
							updated_at: new Date(0)
						}
					}
				}
			});
		});
	});

	describe("buildFromRepositoryData", () => {

		it("Should return undefined if the repo ID is not available", async () => {
			let result = RepoSyncState.buildFromRepositoryData(sub);
			expect(result).toBe(undefined);
			result = RepoSyncState.buildFromRepositoryData(sub, {
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				lastBranchCursor: "foo",
				lastCommitCursor: "bar",
				lastPullCursor: 12,
				repository: {
					name: "github-for-jira",
					full_name: "atlassian/github-for-jira",
					html_url: "github.com/atlassian/github-for-jira",
					owner: {
						login: "atlassian"
					},
					updated_at: 0
				}
			} as any);
			expect(result).toBe(undefined);
		});

		it("Should build a Model based on Repo Data", async () => {
			const result = RepoSyncState.buildFromRepositoryData(sub, {
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				lastBranchCursor: "foo",
				lastCommitCursor: "bar",
				lastPullCursor: 12,
				repository: {
					id: "1",
					name: "github-for-jira",
					full_name: "atlassian/github-for-jira",
					html_url: "github.com/atlassian/github-for-jira",
					owner: {
						login: "atlassian"
					},
					updated_at: 0
				}
			});
			expect(result).toMatchObject({
				repoId: 1,
				subscriptionId: sub.id,
				repoName: "github-for-jira",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira",
			});
		});
	});

	describe("setFromRepositoryData", () => {
		it("Should set properties on a Model based on Repo JSON", async () => {
			const state = RepoSyncState.build(repo);

			state.setFromRepositoryData({
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				lastBranchCursor: "foo",
				lastCommitCursor: "bar",
				lastPullCursor: 12,
				repository: {
					id: "1",
					name: "github-for-jira",
					full_name: "atlassian/github-for-jira",
					html_url: "github.com/atlassian/github-for-jira",
					owner: {
						login: "atlassian"
					},
					updated_at: 0
				}
			});
			expect(state).toMatchObject({
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				branchCursor: "foo",
				commitCursor: "bar",
				pullCursor: "12",
				repoUpdatedAt: new Date(0)
			});
		});
	});

	describe("toRepositoryData", () => {
		it("Should return RepositoryData JSON from Model data", async () => {
			const state = RepoSyncState.build({
				...repo,
				branchStatus: "complete",
				branchCursor: "foo",
				commitStatus: "complete",
				commitCursor: "bar",
				pullStatus: "complete",
				pullCursor: "12",
				repoUpdatedAt: new Date(0)
			});
			expect(state.toRepositoryData()).toMatchObject({
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				lastBranchCursor: "foo",
				lastCommitCursor: "bar",
				lastPullCursor: 12,
				repository: {
					id: "1",
					name: "github-for-jira",
					full_name: "atlassian/github-for-jira",
					html_url: "github.com/atlassian/github-for-jira",
					owner: {
						login: "atlassian"
					},
					updated_at: new Date(0)
				}
			});
		});
	});
});
