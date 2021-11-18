import { Step, StepPrioritizer, StepProcessor } from "./looper/api";
import { JobId, JobState } from "./index";
import { RepositoryData } from "../models/subscription";
import { PullRequestProcessor } from "./pull-request-processor";
import { BranchProcessor } from "./branch-processor";
import { CommitProcessor } from "./commit-processor";

export class Prioritizer implements StepPrioritizer<JobId, JobState> {

	private readonly commitsSkipCount: number;
	private readonly pullrequestSkipCount: number;

	constructor(
		commitsSkipCount?: number,
		pullrequestSkipCount?: number
	) {
		this.commitsSkipCount = commitsSkipCount || 10;
		this.pullrequestSkipCount = pullrequestSkipCount || 10;
	}

	getStepProcessor(_: Step<JobId>, jobState: JobState): StepProcessor<JobState> | null | undefined {

		if (Prioritizer.hasWaitingPullrequests(jobState.repositoryState)) {
			return new PullRequestProcessor();
		} else if (Prioritizer.hasWaitingBranches(jobState.repositoryState)) {
			return new BranchProcessor();
		} else if (Prioritizer.hasWaitingCommits(jobState.repositoryState)) {
			return new CommitProcessor();
		} else {
			// The job is done.
			return undefined;
		}

	}

	skip(_: Step<JobId>, jobState: JobState): JobState {
		const repo = jobState.repositoryState;

		if (Prioritizer.hasWaitingPullrequests(jobState.repositoryState)) {
			if (!repo.lastPullCursor) {
				repo.lastPullCursor = 0;
			}
			repo.lastPullCursor += this.pullrequestSkipCount;
		} else if (Prioritizer.hasWaitingBranches(repo)) {
			// Branches have an opaque cursor, so we can't skip a page.
			// We have to mark the "sub task" to fetch branches as failed so we don't try to load branches from the same
			// repository again.
			repo.branchStatus = "failed";
		} else {
			// Commits have a partly opaque cursor (opaque cursor ID followed by a page number).
			// If we don't have a cursor, yet, we can't skip and have to fail instead.
			if (!repo.lastCommitCursor) {
				repo.commitStatus = "failed";
			} else {
				const commitCursorRegex = /^([^ ]+) ([0-9]+)$/;
				const cursorParts = repo.lastCommitCursor.match(commitCursorRegex);
				if (!cursorParts || cursorParts.length != 3) {
					repo.commitStatus = "failed";
				} else {
					const cursorId = cursorParts[1];
					const index = cursorParts[2];
					repo.lastCommitCursor = `${cursorId} ${+index + this.commitsSkipCount}`;
				}
			}
		}

		return jobState;
	}

	private static hasWaitingPullrequests(repo: RepositoryData): boolean {
		return repo.pullStatus === "pending" || repo.pullStatus == undefined;
	}

	private static hasWaitingBranches(repo: RepositoryData): boolean {
		return repo.branchStatus === "pending" || repo.branchStatus == undefined;
	}

	private static hasWaitingCommits(repo: RepositoryData): boolean {
		return repo.commitStatus === "pending" || repo.commitStatus == undefined;
	}

}
