import { RepoSyncState } from "models/reposyncstate";

export interface JobId {
	installationId: number;
	jiraHost: string;
}

/**
 * The JobState contains the state of only one repository. This is the repository that should be processed in the
 * next step of the job. The JobStore implementation that is responsible for loading the
 * JobState from the database must choose which repository is the next to be worked on (for example by sorting them
 * by the last updated date to pick the one that was not updated for the longest time).
 */
export interface JobState {
	installationId: number;
	jiraHost: string;
	numberOfSyncedRepos?: number;
	repository: RepoSyncState;
}

/**
 * A processing step in a job. A job consists of multiple steps.
 *
 * A step does not hold any information about what to do exactly. The StepProcessor will decide based on the JobState
 * what exactly to do.
 */
export interface Step<JOB_ID> {
	jobId: JOB_ID;
}

/**
 * Processes a single step of a job.
 *
 * In practice, a processor will load data from a data source, transform it into another shape, and send it to
 * a data sink.
 */
export interface StepProcessor<JOB_STATE> {

	/**
	 * Processes the next step in the job. Can make use of the JobState to determine what exactly it needs to do
	 * as the next step.
	 */
	process(jobState: JOB_STATE, currentRateLimitState?: RateLimitState): StepResult<JOB_STATE>;

}

export interface StepResult<JOB_STATE> {

	/**
	 * True if the processing step was successful. False if the processing was not successful. In this case, the error
	 * field should be populated with information about the error.
	 */
	success: boolean;

	/**
	 * The job state after the step has been processed.
	 */
	jobState: JOB_STATE;

	/**
	 * Information about the state of the rate limit for the job after successful or unsuccessful processing of the step.
	 */
	rateLimit?: RateLimitState;

	/**
	 * Information about the error, if an error has occurred during processing.
	 */
	error?: {
		message: string;
		isRetryable: boolean;
		isFatal: boolean;
	};
}

/**
 * A factory that can decide what processor should process this step based on some state in the database.
 */
export interface StepPrioritizer<JOB_ID, JOB_STATE> {

	/**
	 * Decides which StepProcessor should process the step. Can make a decision based on the JobState and RateLimitState.
	 *
	 * If the job entails the processing items of different types, for example, this method can prioritize between them.
	 * It can also prioritize based on recency (i.e. which item type has longest not been updated), or on the state of
	 * a rate limit.
	 *
	 * Return null or undefined when the job is done and there is nothing left to do.
	 */
	getStepProcessor(step: Step<JOB_ID>, jobState: JOB_STATE, rateLimitState?: RateLimitState): StepProcessor<JOB_STATE> | null | undefined;

	/**
	 * Modifies the job state to skip the current step (by incrementing a cursor or something like that).
	 * Returns the modified job state.
	 */
	skip(step: Step<JOB_ID>, jobState: JOB_STATE, rateLimitState?: RateLimitState): JOB_STATE;
}

export interface RateLimitState {

	/**
	 * The rate limit budget that is left. If 0, the rate limit is hit.
	 */
	budgetLeft: number;

	/**
	 * The date at which the rate limit will refresh (i.e. the budget will increase).
	 */
	refreshDate: Date;
}

/**
 * Interface to a database that stores state about the Job.
 */
export interface JobStore<JOB_ID, JOB_STATE> {
	/**
	 * Returns the jobState for the given job.
	 */
	getJobState(jobId: JOB_ID): JOB_STATE;

	/**
	 * Updates the job state in the database.
	 */
	setJobState(jobId: JOB_ID, jobState: JOB_STATE);

	/**
	 * Increments the number of failed attempts for the current step of the given job in the database.
	 */
	setFailedAttemptsCount(jobId: JOB_ID, count: number);

	/**
	 * Retrieves the number of failed attempts for the current step of the given job from the database.
	 */
	getFailedAttemptsCount(jobId: JOB_ID);

	/**
	 * Updates the rate limit state for the given job in the database.
	 */
	updateRateLimitState(jobId: JOB_ID, rateLimitState: RateLimitState);

	/**
	 * Retrieves the current rate limit state for the given job in the database.
	 * @param jobId
	 */
	getRateLimitState(jobId: JOB_ID): RateLimitState | undefined;
}

/**
 * Strategy that decides if a step should be retried and how long a retry should be delayed. Retrying means that the
 * next step of the job should try to do exactly the same as the previous step, because it's expected to work after retrying a few times.
 */
export interface RetryStrategy {
	/**
	 * Decides based on the already failed attempts if a step should be retried and how long the retry should be delayed.
	 */
	getRetry(failedAttempts: number): Retry;
}

export interface Retry {
	shouldRetry: boolean;
	retryAfterSeconds?: number;
}

/**
 * Strategy that decides how long to delay based on the state of a rate limit.
 */
export interface RateLimitStrategy {

	/**
	 * Calculates number of seconds the next step of the job should wait to not trigger the rate limit.
	 */
	getDelayInSeconds(rateLimitState?: RateLimitState): number;
}

/**
 * Information about the next action that should be taken after a step has been processed.
 */
export interface NextAction<JOB_ID> {

	/**
	 * Identifier for the job.
	 */
	jobId: JOB_ID;

	/**
	 * If this is true, the job isn't finished, yet. Go ahead and schedule the next step of the job.
	 * If this is false, the job is finished.
	 */
	scheduleNextStep: boolean;

	/**
	 * If this is set, the next step should be delayed.
	 */
	delay?: {
		seconds: number;
		reason: "retry" | "rate-limit"
	};
}
