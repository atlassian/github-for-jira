
/* eslint-disable jest/no-standalone-expect */
import {
	CappedDelayRateLimitStrategy,
} from "./capped-delay-ratelimit-strategy";
import { Looper } from "./looper";
import { getLogger } from "../../config/logger";
import each from "jest-each";
import { JobStore, RateLimitState, Step, StepPrioritizer, StepProcessor, StepResult } from "../backfill.types";
import { BackoffRetryStrategy } from "./backoff-retry-strategy";

const logger = getLogger("looper.test.ts")

describe("Looper", () => {

	let now = new Date(2021, 10, 10, 10, 10, 10);
	const nowFunction = () => now;
	const aMinuteFromNow = new Date(2021, 10, 10, 10, 11, 10);

	const DATABASE = {
		rateLimitState: {
			budgetLeft: 5,
			refreshDate: aMinuteFromNow
		},
		jobState: {
			cursor: 0
		},
		failedAttemptsCount: 0
	}

	type JobId = string;

	type JobState = {
		cursor: number;
	};

	class MyProcessor implements StepProcessor<JobState> {

		private readonly failingCursors: number[] = [];
		itemsProcessed: number[] = [];

		constructor(failingCursors: number[]) {
			this.failingCursors = failingCursors;
		}

		process(jobState: JobState, rateLimitState: RateLimitState): StepResult<JobState> {
			rateLimitState.budgetLeft--;

			if (this.failingCursors.includes(jobState.cursor)) {
				return {
					success: false,
					rateLimit: rateLimitState,
					error: {
						isRetryable: true,
						message: "retryable error",
						isFatal: false
					},
					jobState
				}
			}

			this.itemsProcessed.push(jobState.cursor);
			jobState.cursor++;
			return {
				success: true,
				rateLimit: rateLimitState,
				jobState
			}
		}
	}

	class MyPrioritizer implements StepPrioritizer<JobId, JobState> {

		private readonly processor: StepProcessor<JobState>;

		constructor(processor: StepProcessor<JobState>) {
			this.processor = processor;
		}

		getStepProcessor(_step: Step<JobId>, jobState: JobState): StepProcessor<JobState> | null | undefined {
			if (jobState.cursor < 10) {
				return this.processor;
			} else {
				return undefined;
			}
		}

		skip(_step: Step<JobId>, jobState: JobState): JobState {
			if (jobState.cursor < 10) {
				jobState.cursor++;
			}
			return jobState;
		}
	}

	class MyJobStore implements JobStore<JobId, JobState> {

		getFailedAttemptsCount() {
			return DATABASE.failedAttemptsCount
		}

		getJobState(): JobState {
			return DATABASE.jobState;
		}

		getRateLimitState(): RateLimitState | undefined {
			return DATABASE.rateLimitState;
		}

		setFailedAttemptsCount(_jobId: JobId, count: number) {
			DATABASE.failedAttemptsCount = count;
		}

		updateRateLimitState(_jobId: JobId, rateLimitState: RateLimitState) {
			DATABASE.rateLimitState = rateLimitState;
		}

		setJobState(_jobId: JobId, jobState: JobState) {
			DATABASE.jobState = jobState;
		}
	}

	const jobStore = new MyJobStore();
	const processor = new MyProcessor([3, 7]);
	const prioritizer = new MyPrioritizer(processor);

	const looper = new Looper<JobId, JobState>(
		prioritizer,
		jobStore,
		new CappedDelayRateLimitStrategy(15 * 60, nowFunction),
		new BackoffRetryStrategy(3, 2, 2),
		logger
	);

	it("completes a loop through a job", async () => {

		let nextAction = looper.processStep({ jobId: "job1" });
		let i = 1;
		let retryCount = 0;
		let ratelimitedCount = 0;

		// In a real implementation, this would not be called in a simple loop, but instead triggered by an async queue mechanism.
		while (nextAction.scheduleNextStep) {

			logger.info(`STATE AFTER STEP ${i}: ${JSON.stringify(DATABASE, null, 2)}`)

			// travel into the future to simulate waiting time and refresh the rate limit
			if (nextAction.delay) {
				logger.info(`DELAYING BY ${nextAction.delay.seconds} seconds due to ${nextAction.delay.reason}!`);
				now = new Date(now.getTime() + nextAction.delay.seconds * 1000);

				if(nextAction.delay.reason == "retry"){
					retryCount++;
				}

				// refresh the rate limit
				if (nextAction.delay.reason == "rate-limit") {
					ratelimitedCount++;
					logger.info("REFRESHING RATE LIMIT");
					DATABASE.rateLimitState.refreshDate = new Date(now.getTime() + 60 * 1000);
					DATABASE.rateLimitState.budgetLeft = 5;
				}
			}

			nextAction = looper.processStep({ jobId: "job1" });
			i++;
		}

		expect(DATABASE.jobState.cursor).toBe(10);
		expect(processor.itemsProcessed).toHaveLength(8);
		expect(processor.itemsProcessed).toEqual(expect.arrayContaining([1, 2, 4, 5, 6, 8, 9]));
		expect(processor.itemsProcessed).not.toContain(3) // item 3 was skipped due to failed retries
		expect(processor.itemsProcessed).not.toContain(7) // item 7 was skipped due to failed retries
		expect(retryCount).toBe(6) // 2 * 3 retries
		expect(ratelimitedCount).toBe(3) // the rate limit budget should have run out 3 times

	});

	describe("BackoffRetryStrategy", () => {

		each([
			[3, 0, true, 2],
			[3, 1, true, 4],
			[3, 2, true, 8],
			[3, 3, true, 16],
			[3, 4, false, 32],
			[3, 5, false, 64],
			[3, 6, false, 128],
		]).it("input: retries=%s, failed attempts=%s; output: shouldRetry=%s, delay=%s", async (retries: number, failedAttempts: number, expectedToRetry: boolean, expectedDelay: boolean) => {
			const backoffStrategy = new BackoffRetryStrategy(retries, 2, 2);
			expect(backoffStrategy.getRetry(failedAttempts).shouldRetry).toBe(expectedToRetry);
			expect(backoffStrategy.getRetry(failedAttempts).retryAfterSeconds).toBe(expectedDelay);
		});

		it("throws error on invalid input", async () => {
			expect(() => new BackoffRetryStrategy(3, -1, 2)).toThrow();
			expect(() => new BackoffRetryStrategy(3, 2, -1)).toThrow();
			expect(() => new BackoffRetryStrategy(-1, 2, -1)).toThrow();
		});

		it("honors maxDelay", async () => {
			const backoffStrategy = new BackoffRetryStrategy(10, 2, 2, 10);
			expect(backoffStrategy.getRetry(5).shouldRetry).toBe(true);
			expect(backoffStrategy.getRetry(5).retryAfterSeconds).toBe(10);
		});


	});

	describe("CappedDelayRateLimitStrategy", () => {

		const now = new Date(2021, 10, 10, 10);
		const fiveMinutesFromNow = new Date(2021, 10, 10, 10, 5);
		const anHourFromNow = new Date(2021, 10, 11);
		const fiveMinutesAgo = new Date(2021, 10, 10, 9, 55);

		const rateLimit = (budgetLeft: number, refreshDate: Date): RateLimitState => {
			return {
				budgetLeft,
				refreshDate
			};
		};

		each([
			[900, now, rateLimit(1, anHourFromNow), 0], 					// no delay because budget left
			[900, now, rateLimit(0, anHourFromNow), 900], 				// delay capped at max
			[900, now, rateLimit(0, fiveMinutesFromNow), 5 * 60], // delay of 5 minutes because budget is empty
			[900, now, rateLimit(-1, fiveMinutesFromNow), 300], 	// delay of 5 minutes because budget is empty
			[900, now, rateLimit(0, fiveMinutesAgo), 0], 					// no delay, because refresh date is in the past
			[-1, now, rateLimit(0, fiveMinutesAgo), 0], 					// no delay because of invalid cap value
			[900, now, undefined, 0], 																			// no delay because no rate limit provided
		]).it("input: maxDelay=%s, now=%s, rateLimit=%s; output: expectedDelay=%s", async (maxDelay: number, now: Date, ratelimit: RateLimitState, expectedDelay: number) => {
			const retryStrategy = new CappedDelayRateLimitStrategy(maxDelay, () => now);
			const delay = retryStrategy.getDelayInSeconds(ratelimit);
			expect(delay).toBe(expectedDelay);
		});

	});

});
