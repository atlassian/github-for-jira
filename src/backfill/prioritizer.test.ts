/* eslint-disable jest/no-standalone-expect */
import { Prioritizer } from "./prioritizer";
import { TaskStatus } from "models/subscription";
import { JobId, JobState, Step } from "./backfill.types";
import { CommitProcessor } from "./commit-processor";
import { BranchProcessor } from "./branch-processor";
import { PullRequestProcessor } from "./pull-request-processor";
import { RepoSyncState } from "models/reposyncstate";

describe("Prioritizer", () => {

	it("processes pullrequests with priority 1", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.getStepProcessor(step(), jobStateWithWaitingPullrequests())).toBeInstanceOf(PullRequestProcessor);
	});

	it("processes branches with priority 2", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.getStepProcessor(step(), jobStateWithWaitingBranches())).toBeInstanceOf(BranchProcessor);
	});

	it("processes commits with priority 3", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.getStepProcessor(step(), jobStateWithWaitingCommits())).toBeInstanceOf(CommitProcessor);
	});

	it("skips pullrequests", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.skip(step(), jobStateWithWaitingPullrequests()).repository.pullCursor).toEqual("d384b094c49adcd9d2887b25f9fd7d31025b824d 20");
		expect(prioritizer.skip(step(), jobStateWithWaitingPullrequests()).repository.pullStatus).toEqual("pending");
	});

	it("fails branches sub task when skipping branches", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.skip(step(), jobStateWithWaitingBranches()).repository.branchStatus).toEqual("failed");
	});

	it("skips commits", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.skip(step(), jobStateWithWaitingCommits()).repository.commitCursor).toEqual("25f9fd7d31025b824dd384b094c49adcd9d2887b 49");
		expect(prioritizer.skip(step(), jobStateWithWaitingCommits()).repository.commitStatus).toEqual("pending");
	});

	it("fails commits sub task when invalid cursor", async () => {
		const prioritizer = new Prioritizer();
		const jobState = jobStateWithWaitingCommits();
		jobState.repository.commitCursor = undefined;
		expect(prioritizer.skip(step(), jobState).repository.commitStatus).toEqual("failed");
	});

	const step = (): Step<JobId> => {
		return {
			jobId: {
				installationId: 1234,
				jiraHost: "https://foo.atlassian.net"
			}
		};
	};

	const jobStateWithWaitingPullrequests = (): JobState =>
		jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"pending",
			"foo",
			"pending",
			"d384b094c49adcd9d2887b25f9fd7d31025b824d 10");

	const jobStateWithWaitingBranches = (): JobState =>
		jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"pending",
			"foo",
			"complete",
			"d384b094c49adcd9d2887b25f9fd7d31025b824d 10");

	const jobStateWithWaitingCommits = (): JobState =>
		jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"complete",
			"foo",
			"complete",
			"d384b094c49adcd9d2887b25f9fd7d31025b824d 10");

	const jobState = (
		commitStatus: TaskStatus,
		commitCursor: string,
		branchStatus: TaskStatus,
		branchCursor: string,
		pullrequestStatus: TaskStatus,
		pullCursor: string
	): JobState => ({
		installationId: 4711,
		jiraHost: "https://foo.atlassian.net",
		numberOfSyncedRepos: 0,
		repository: {
			commitCursor,
			pullCursor,
			branchCursor,
			commitStatus: commitStatus,
			branchStatus: branchStatus,
			pullStatus: pullrequestStatus,
			id: 1234,
			repoName: "repo1",
			repoFullName: "repo1",
			repoOwner: "owner",
			repoUrl: "https://github.com/foo",
			repoUpdatedAt: new Date()
		} as RepoSyncState
	});
});

