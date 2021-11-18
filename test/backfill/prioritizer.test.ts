/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */
import { Prioritizer } from "../../src/backfill/prioritizer";
import { TaskStatus } from "../../src/models/subscription";
import { JobId, JobState } from "../../src/backfill";
import { Step } from "../../src/backfill/looper/api";
import { CommitProcessor } from "../../src/backfill/commit-processor";
import { BranchProcessor } from "../../src/backfill/branch-processor";
import { PullRequestProcessor } from "../../src/backfill/pull-request-processor";

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
		expect(prioritizer.skip(step(), jobStateWithWaitingPullrequests()).repositoryState.lastPullCursor).toEqual(20);
		expect(prioritizer.skip(step(), jobStateWithWaitingPullrequests()).repositoryState.pullStatus).toEqual("pending");
	});

	it("fails branches sub task when skipping branches", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.skip(step(), jobStateWithWaitingBranches()).repositoryState.branchStatus).toEqual("failed");
	});

	it("skips commits", async () => {
		const prioritizer = new Prioritizer();
		expect(prioritizer.skip(step(), jobStateWithWaitingCommits()).repositoryState.lastCommitCursor).toEqual("25f9fd7d31025b824dd384b094c49adcd9d2887b 49");
		expect(prioritizer.skip(step(), jobStateWithWaitingCommits()).repositoryState.commitStatus).toEqual("pending");
	});

	it("fails commits sub task when invalid cursor", async () => {
		const prioritizer = new Prioritizer();
		const jobState = jobStateWithWaitingCommits();
		jobState.repositoryState.lastCommitCursor = undefined;
		expect(prioritizer.skip(step(), jobState).repositoryState.commitStatus).toEqual("failed");
	});

	function step(): Step<JobId> {
		return {
			jobId: {
				installationId: 1234,
				jiraHost: "https://foo.atlassian.net"
			}
		}
	}

	function jobStateWithWaitingPullrequests(): JobState {
		return jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"pending",
			"foo",
			"pending",
			10);
	}

	function jobStateWithWaitingBranches(): JobState {
		return jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"pending",
			"foo",
			"complete",
			10);
	}

	function jobStateWithWaitingCommits(): JobState {
		return jobState(
			"pending",
			"25f9fd7d31025b824dd384b094c49adcd9d2887b 39",
			"complete",
			"foo",
			"complete",
			10);
	}

	function jobState(
		commitStatus: TaskStatus,
		lastCommitCursor: string,
		branchStatus: TaskStatus,
		lastBranchCursor: string,
		pullrequestStatus: TaskStatus,
		lastPullrequestCursor: number
	): JobState {
		return {
			installationId: 4711,
			jiraHost: "https://foo.atlassian.net",
			numberOfSyncedRepos: 0,
			repositoryState: {
				lastCommitCursor: lastCommitCursor,
				lastPullCursor: lastPullrequestCursor,
				lastBranchCursor: lastBranchCursor,
				commitStatus: commitStatus,
				branchStatus: branchStatus,
				pullStatus: pullrequestStatus
			},
			repository: {
				id: "foo",
				name: "repo1",
				full_name: "repo1",
				owner: {
					login: "owner"
				},
				html_url: "https://github.com/foo",
				updated_at: 42
			}
		}
	}
});

