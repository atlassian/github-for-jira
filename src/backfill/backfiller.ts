import {
	JobStore,
	StepResult,
	StepPrioritizer,
	RateLimitState,
	RateLimitStrategy, Step, RetryStrategy, StepProcessor
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
	 * Number of seconds to delay the next step of the job to not run into rate limits (or to wait
	 * until a rate limit is refreshed).
	 */
	delayInSeconds?: number;
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
			return this.continueJobWithRateLimit(step, currentRateLimitState);
		}

		// find the right processor and process the next step of the job
		const jobState = this.jobStore.getJobState(step.jobId);
		const stepProcessor = this.prioritizer.getStepProcessor(step, jobState, currentRateLimitState);
		const stepResult = stepProcessor.process(jobState);

		// store the new rate limit state in the database
		this.updateRateLimitState(stepResult, step);

		// the job is finished, don't schedule another step
		if (stepResult.jobFinished) {
			return this.stopJob(step);
		}

		// in case of success, we want to schedule the job back on the queue
		if (stepResult.success) {
			return this.continueJobWithRateLimit(step, stepResult.rateLimit);
		}

		// in case of an error we want to throw an error to let the queueing system know that we want to retry
		if (!stepResult.error || stepResult.error?.isRetryable) {
			this.logger.error(`Retrying step ${JSON.stringify(step)} due to error: ${stepResult.error?.message}`);
			return this.retryStep(step, stepProcessor, stepResult);
		} else if (stepResult.error.isFatal) {
			this.logger.error(`Stopping job ${step.jobId} due to error: ${stepResult.error?.message}`);
			return this.stopJob(step);
		} else {
			this.logger.error(`Skipping step ${JSON.stringify(step)} due to error: ${stepResult.error?.message}`);
			return stepProcessor.skip();
		}
	}

	/**
	 * If the RetryStrategy determines the step should be retried, increment the failed attempts counter and return an
	 * action to continue the job.
	 *
	 * If the retry limit has been reached, skip the step.
	 */
	private retryStep(step: Step<JOB_ID>, stepProcessor: StepProcessor<JOB_STATE>, stepResult: StepResult): NextAction<JOB_ID> {
		const failedAttempts = this.jobStore.getFailedAttemptsCount(step.jobId);

		const retry = this.retryStrategy.getRetry(failedAttempts);

		if (retry.shouldRetry
		) {
			// Retry the same step again, honoring the retry delay.
			this.jobStore.setFailedAttemptsCount(step.jobId, failedAttempts + 1);
			return this.continueJobWithDelay(step, retry.retryAfterSeconds);
		} else {
			// Don't retry. Reset the failed attempts and skip the current step.
			this.jobStore.setFailedAttemptsCount(step.jobId, 0);
			stepProcessor.skip();
		}

		return this.continueJobWithRateLimit(step, stepResult.rateLimit);
	}

	private continueJobWithDelay(step: Step<JOB_ID>, delayInSeconds ?: number): NextAction<JOB_ID> {
		return {
			jobId: step.jobId,
			scheduleNextStep: true,
			delayInSeconds: delayInSeconds
		};
	}

	private continueJobWithRateLimit(step: Step<JOB_ID>, rateLimitState ?: RateLimitState): NextAction<JOB_ID> {
		return this.continueJobWithDelay(step, this.rateLimitStrategy.getDelayInSeconds(rateLimitState));
	}

	private stopJob(step: Step<JOB_ID>): NextAction<JOB_ID> {
		return {
			jobId: step.jobId,
			scheduleNextStep: false,
		};
	}

	private updateRateLimitState(stepResult: StepResult, step: Step<JOB_ID>) {
		if (stepResult.rateLimit) {
			this.jobStore.updateRateLimitState(step.jobId, stepResult.rateLimit);
		}
	}
}
