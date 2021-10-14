import {
	JobStore,
	RateLimitState,
	RateLimitStrategy,
	RetryStrategy,
	Step,
	StepPrioritizer,
	StepResult
} from "./api";
import Logger from "bunyan";

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
	}
}

export class Backfiller<JOB_ID, JOB_STATE> {

	private readonly prioritizer: StepPrioritizer<JOB_ID, JOB_STATE>;
	private readonly jobStore: JobStore<JOB_ID, JOB_STATE>;
	private readonly rateLimitStrategy: RateLimitStrategy;
	private readonly retryStrategy: RetryStrategy;
	private readonly logger: Logger;

	constructor(
		prioritizer: StepPrioritizer<JOB_ID, JOB_STATE>,
		jobStore: JobStore<JOB_ID, JOB_STATE>,
		rateLimitStrategy: RateLimitStrategy,
		retryStrategy: RetryStrategy,
		logger: Logger
	) {
		this.prioritizer = prioritizer;
		this.jobStore = jobStore;
		this.rateLimitStrategy = rateLimitStrategy;
		this.retryStrategy = retryStrategy;
		this.logger = logger;
	}

	/**
	 * Processes the next step of the given job. This method should be called again and again for the same job until
	 * the return NextAction.scheduleNextStep is false. If NextAction.delayInSeconds is set, don't call the method
	 * for the same job again before this number of seconds has passed to honor rate limits.
	 */
	public processStep(step: Step<JOB_ID>): NextAction<JOB_ID> {

		const currentRateLimitState = this.jobStore.getRateLimitState(step.jobId);

		// If the rate limit is hit, delay the next step of the job accordingly.
		if (this.rateLimitStrategy.getDelayInSeconds(currentRateLimitState) > 0) {
			this.logger.info("RATE LIMIT HIT!");
			return this.continueJobWithRateLimitDelay(step, currentRateLimitState);
		}

		// find the right processor and process the next step of the job
		const jobState = this.jobStore.getJobState(step.jobId);
		const stepProcessor = this.prioritizer.getStepProcessor(step, jobState, currentRateLimitState);

		if (!stepProcessor) {
			return this.stopJob(step);
		}

		const stepResult = stepProcessor.process(jobState, currentRateLimitState);

		// store the new rate limit state in the database
		this.updateRateLimitState(stepResult, step);
		this.jobStore.setJobState(step.jobId, stepResult.jobState);

		// in case of success, we want to schedule the job back on the queue
		if (stepResult.success) {
			return this.continueJobWithRateLimitDelay(step, stepResult.rateLimit);
		}

		// in case of an error we want to throw an error to let the queueing system know that we want to retry
		if (!stepResult.error || stepResult.error?.isRetryable) {
			return this.retryStep(step, stepResult, jobState);
		} else if (stepResult.error.isFatal) {
			this.logger.error(`Stopping job ${step.jobId} due to error: ${stepResult.error?.message}`);
			return this.stopJob(step);
		} else if (!stepResult.error.isRetryable) {
			this.logger.error(`Skipping step ${JSON.stringify(step)} due to error: ${stepResult.error?.message}`);
			this.skipStep(step, jobState, stepResult);
		}

		throw new Error(`Job ${step.jobId} ran into an invalid error state: ${JSON.stringify(stepResult.error)}`);
	}

	private skipStep(step: Step<JOB_ID>, jobState: JOB_STATE, stepResult: StepResult<JOB_STATE>): NextAction<JOB_ID> {
		const updatedJobState = this.prioritizer.skip(step, jobState, stepResult.rateLimit);
		this.jobStore.setJobState(step.jobId, updatedJobState);
		return this.continueJobWithRateLimitDelay(step, stepResult.rateLimit);
	}

	/**
	 * If the RetryStrategy determines the step should be retried, increment the failed attempts counter and return an
	 * action to continue the job.
	 *
	 * If the retry limit has been reached, skip the step.
	 */
	private retryStep(step: Step<JOB_ID>, stepResult: StepResult<JOB_STATE>, jobState: JOB_STATE): NextAction<JOB_ID> {
		const failedAttempts = this.jobStore.getFailedAttemptsCount(step.jobId) + 1;

		const retry = this.retryStrategy.getRetry(failedAttempts);

		if (retry.shouldRetry) {
			// Retry the same step again, honoring the retry delay.
			this.logger.warn(`Retrying step ${JSON.stringify(step)} due to error: ${stepResult.error?.message}`);
			this.jobStore.setFailedAttemptsCount(step.jobId, failedAttempts);
			return this.continueJobWithRetryDelay(step, retry.retryAfterSeconds);
		} else {
			// Don't retry. Reset the failed attempts and skip the current step.
			this.logger.warn(`Not retrying step ${JSON.stringify(step)} after ${failedAttempts} failed attempts. Error was: ${stepResult.error?.message}`);
			this.jobStore.setFailedAttemptsCount(step.jobId, 0);
			return this.skipStep(step, jobState, stepResult);
		}

		return this.continueJobWithRateLimitDelay(step, stepResult.rateLimit);
	}

	private continueJobWithRetryDelay(step: Step<JOB_ID>, delayInSeconds?: number): NextAction<JOB_ID> {
		return {
			jobId: step.jobId,
			scheduleNextStep: true,
			delay: !delayInSeconds
				? undefined
				: {
					seconds: delayInSeconds,
					reason: "retry"
				}
		};
	}

	private continueJobWithRateLimitDelay(step: Step<JOB_ID>, rateLimitState?: RateLimitState): NextAction<JOB_ID> {
		const delayInSeconds = this.rateLimitStrategy.getDelayInSeconds(rateLimitState)
		return {
			jobId: step.jobId,
			scheduleNextStep: true,
			delay: !rateLimitState || delayInSeconds == 0
				? undefined
				: {
					seconds: delayInSeconds,
					reason: "rate-limit"
				}
		};
	}

	private stopJob(step: Step<JOB_ID>): NextAction<JOB_ID> {
		return {
			jobId: step.jobId,
			scheduleNextStep: false,
		};
	}

	private updateRateLimitState(stepResult: StepResult<JOB_STATE>, step: Step<JOB_ID>) {
		if (stepResult.rateLimit) {
			this.jobStore.updateRateLimitState(step.jobId, stepResult.rateLimit);
		}
	}
}
