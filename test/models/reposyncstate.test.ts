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

	describe("findAllFromSubscription", () => {
		it("Should return no repos", async () => {
			let repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(0);
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(0);
		});

		it("Should get all repos from specific subscription", async () => {
			await RepoSyncState.create(repo);
			await RepoSyncState.create({
				...repo,
				subscriptionId: Math.round(Math.random() * 10000)
			});
			const repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(1);
			expect(repos[0]).toMatchObject(repo);
		});
	});

	describe("deleteAllStateFromSubscription", () => {
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
			await RepoSyncState.deleteAllFromSubscription(sub);
			repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(0);
			repos = await RepoSyncState.findAll();
			expect(repos.length).toEqual(1);
		});
	});

	describe("updateFromJson", () => {
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
			await RepoSyncState.updateFromJson(sub, {
				numberOfSyncedRepos: 2,
				jiraHost: sub.jiraHost,
				installationId: sub.gitHubInstallationId,
				repos: {
					"2": json
				}
			});
			const repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(1);
			const data = repos[0];
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
			await RepoSyncState.updateFromJson(sub, {
				numberOfSyncedRepos: 1,
				jiraHost: sub.jiraHost,
				installationId: sub.gitHubInstallationId,
				repos: {
					"2": json
				}
			});
			repos = await RepoSyncState.findAllFromSubscription(sub);
			expect(repos.length).toEqual(1);
			expect(repos[0].repoId).toEqual(2);
			repos = await RepoSyncState.findAll();
			expect(repos.length).toEqual(2);
		});
	});
});
