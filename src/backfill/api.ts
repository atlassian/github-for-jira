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
	process(jobState: JOB_STATE): StepResult;

	/**
	 * This method is called when the processing of the step has failed for some reason and the same processing
	 * shouldn't be retried.
	 *
	 * An implementation of this function must increment some kind of cursor in the job state so that the next step of the
	 * job doesn't try to do the exact same thing again (and fail again). By moving a cursor, the step is basically skipped.
	 */
	skip();
}

export interface StepResult {

	/**
	 * True if the processing step was successful. False if the processing was not successful. In this case, the error
	 * field should be populated with information about the error.
	 */
	success: boolean;

	/**
	 * Set to true if the whole job is finished (i.e. if this was the last step).
	 */
	jobFinished: boolean;

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
	}
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
	 */
	getStepProcessor(step: Step<JOB_ID>, jobState: JOB_STATE, rateLimitState?: RateLimitState): StepProcessor<JOB_STATE>;
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
 * Calculates a delay with a hard upper limit. Can be used in combination with SQS queues, for example, because
 * they only allow a max delay of 15 minutes.
 */
export class CappedDelayRateLimitStrategy implements RateLimitStrategy {

	private readonly maxDelayInSeconds: number;
	private readonly now: () => Date;

	constructor(maxDelayInSeconds: number, now?: () => Date) {
		this.maxDelayInSeconds = maxDelayInSeconds;
		this.now = now
			? now
			: () => new Date()
	}

	public getDelayInSeconds(rateLimitState?: RateLimitState): number {

		// No rate limit information -> no delay.
		if (!rateLimitState) {
			return 0;
		}

		// We still have budget left -> no delay.
		if (rateLimitState.budgetLeft > 0) {
			return 0;
		}

		const now = this.now();

		// If the refresh date is in the past, we just assume that the rate limit has refreshed already,
		// so no delay is needed.
		if (rateLimitState.refreshDate.getTime() < now.getTime()) {
			return 0;
		}

		// Otherwise, calculate the delay from the rate limit refresh date.
		const delay = (rateLimitState.refreshDate.getTime() - now.getTime()) / 1000;

		return Math.min(delay, this.maxDelayInSeconds);
	}

}

/**
 * A RetryStrategy that simply retries a fix number of times.
 */
export class BackoffRetryStrategy implements RetryStrategy {

	private readonly retries: number;
	private readonly initialDelayInSeconds: number;
	private readonly backoffMultiplier: number;

	constructor(retries: number, initialDelayInSeconds: number, backoffMultiplier: number) {
		if (retries < 0) {
			throw new Error("retries must be greater than 0");
		}

		if (backoffMultiplier < 0) {
			throw new Error("backoffMultiplier must be greater than 0");
		}

		if (initialDelayInSeconds < 0) {
			throw new Error("initialDelayInSeconds must be greater than 0");
		}

		this.retries = retries;
		this.backoffMultiplier = backoffMultiplier;
		this.initialDelayInSeconds = initialDelayInSeconds;
	}

	getRetry(failedAttempts: number): Retry {
		return {
			shouldRetry: failedAttempts <= this.retries + 1, // +1 because with 3 retries, we'll have 4 failed attempts in the end
			retryAfterSeconds: this.initialDelayInSeconds * Math.pow(this.backoffMultiplier, failedAttempts)
		};
	}

}
