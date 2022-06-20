import { PullRequestProcessor } from "./pull-request-processor";
import { BranchProcessor } from "./branch-processor";
import { CommitProcessor } from "./commit-processor";
import { JobId, JobState, Step, StepPrioritizer, StepProcessor } from "./backfill.types";
import { RepoSyncState } from "models/reposyncstate";

// TODO: clean up messy code
export class Prioritizer implements StepPrioritizer<JobId, JobState> {

	// private readonly commitsSkipCount;
	// private readonly pullrequestSkipCount;

	constructor(
		/*commitsSkipCount?: number,
		pullrequestSkipCount?: number*/
	) {
		// this.commitsSkipCount = commitsSkipCount || 10;
		// this.pullrequestSkipCount = pullrequestSkipCount || 10;
	}

	private static hasWaitingPullrequests(repo: RepoSyncState): boolean {
		return repo.pullStatus === "pending" || repo.pullStatus === undefined;
	}

	private static hasWaitingBranches(repo: RepoSyncState): boolean {
		return repo.branchStatus === "pending" || repo.branchStatus == undefined;
	}

	private static hasWaitingCommits(repo: RepoSyncState): boolean {
		return repo.commitStatus === "pending" || repo.commitStatus === undefined;
	}

	getStepProcessor(_: Step<JobId>, jobState: JobState): StepProcessor<JobState> | undefined {
		if (Prioritizer.hasWaitingPullrequests(jobState.repository)) {
			return new PullRequestProcessor();
		} else if (Prioritizer.hasWaitingBranches(jobState.repository)) {
			return new BranchProcessor();
		} else if (Prioritizer.hasWaitingCommits(jobState.repository)) {
			return new CommitProcessor();
		}
		// The job is done.
		return undefined;
	}

	skip(_step: Step<JobId>, jobState: JobState): JobState {
		const repo = jobState.repository;

		if (Prioritizer.hasWaitingPullrequests(jobState.repository)) {
			/*if (!repo.lastPullCursor) {
				repo.lastPullCursor = 0;
			}
			repo.lastPullCursor += this.pullrequestSkipCount;*/
		} else if (Prioritizer.hasWaitingBranches(repo)) {
			// Branches have an opaque cursor, so we can't skip a page.
			// We have to mark the "sub task" to fetch branches as failed so we don't try to load branches from the same
			// repository again.
			repo.branchStatus = "failed";
		} else {
			// Commits have a partly opaque cursor (opaque cursor ID followed by a page number).
			// If we don't have a cursor, yet, we can't skip and have to fail instead.
			/*if (!repo.lastCommitCursor) {
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
			}*/
		}

		return jobState;
	}
}
