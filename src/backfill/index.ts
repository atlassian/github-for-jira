// import { Looper } from "./looper/looper";
// import { BackoffRetryStrategy, CappedDelayRateLimitStrategy, JobStore, RateLimitState } from "./looper/api";
// import { getLogger } from "../config/logger";
import { RepositoryData } from "../models/subscription";
// import { Prioritizer } from "./prioritizer";

export type JobId = {
	installationId: number;
	jiraHost: string;
}

export type JobState = {
	installationId: number;
	jiraHost: string;
	numberOfSyncedRepos?: number;
	repository: RepositoryData;
}

// class DatabaseJobStore implements JobStore<JobId, JobState> {
// 	getFailedAttemptsCount(jobId: JobId) {
// 	}
//
// 	getJobState(jobId: JobId): JobState {
// 		return undefined;
// 	}
//
// 	getRateLimitState(jobId: JobId): RateLimitState | undefined {
// 		return undefined;
// 	}
//
// 	setFailedAttemptsCount(jobId: JobId, count: number) {
// 	}
//
// 	setJobState(jobId: JobId, jobState: JobState) {
// 	}
//
// 	updateRateLimitState(jobId: JobId, rateLimitState: RateLimitState) {
// 	}
//
// }

// const logger = getLogger("backfill");
// const FIFTEEN_MINUTES = 900;
//
// const prioritizer = new Prioritizer();
// // const jobStore = new DatabaseJobStore();
// const ratelimitStrategy = new CappedDelayRateLimitStrategy(FIFTEEN_MINUTES);
// const retryStrategy = new BackoffRetryStrategy(3, 5, 2, FIFTEEN_MINUTES);

// const looper = new Looper<JobId, JobState>(
// 	prioritizer,
// 	undefined,
// 	ratelimitStrategy,
// 	retryStrategy,
// 	logger
// );
