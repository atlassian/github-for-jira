/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import {
	BackoffRetryStrategy,
	CappedDelayRateLimitStrategy,
	JobStore,
	RateLimitState,
	Step,
	StepPrioritizer,
	StepProcessor,
	StepResult
} from "../../../src/backfill/framework/api";
import { Backfiller } from "../../../src/backfill/framework/backfiller";
import { getLogger } from "../../../src/config/logger";

const logger = getLogger("backfiller.test.ts")

describe("Backfiller", () => {

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

	type MyJobId = string;

	type MyJobState = {
		cursor: number;
	};

	class MyProcessor implements StepProcessor<MyJobState> {

		private readonly failingCursors: number[] = [];
		itemsProcessed: number[] = [];

		constructor(failingCursors: number[]) {
			this.failingCursors = failingCursors;
		}

		process(jobState: MyJobState, rateLimitState: RateLimitState): StepResult<MyJobState> {
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

	class MyPrioritizer implements StepPrioritizer<MyJobId, MyJobState> {

		private readonly processor: StepProcessor<MyJobState>;

		constructor(processor: StepProcessor<MyJobState>) {
			this.processor = processor;
		}

		getStepProcessor(_: Step<MyJobId>, jobState: MyJobState, __?: RateLimitState): StepProcessor<MyJobState> | null | undefined {
			if (jobState.cursor < 10) {
				return this.processor;
			} else {
				return undefined;
			}
		}

		skip(_: Step<MyJobId>, jobState: MyJobState, __?: RateLimitState): MyJobState {
			if (jobState.cursor < 10) {
				jobState.cursor++;
			}
			return jobState;
		}
	}

	class MyJobStore implements JobStore<MyJobId, MyJobState> {

		getFailedAttemptsCount(_: MyJobId) {
			return DATABASE.failedAttemptsCount
		}

		getJobState(_: MyJobId): MyJobState {
			return DATABASE.jobState;
		}

		getRateLimitState(_: MyJobId): RateLimitState | undefined {
			return DATABASE.rateLimitState;
		}

		setFailedAttemptsCount(_: MyJobId, count: number) {
			DATABASE.failedAttemptsCount = count;
		}

		updateRateLimitState(_: MyJobId, rateLimitState: RateLimitState) {
			DATABASE.rateLimitState = rateLimitState;
		}

		setJobState(_: MyJobId, jobState: MyJobState) {
			DATABASE.jobState = jobState;
		}

	}

	const jobStore = new MyJobStore();
	const processor = new MyProcessor([3, 7]);
	const prioritizer = new MyPrioritizer(processor);

	const backfiller = new Backfiller<MyJobId, MyJobState>(
		prioritizer,
		jobStore,
		new CappedDelayRateLimitStrategy(15 * 60, nowFunction),
		new BackoffRetryStrategy(3, 2, 2),
		logger
	);

	it("finishes a backfill", async () => {

		let nextAction = backfiller.processStep({ jobId: "job1" });
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

			nextAction = backfiller.processStep({ jobId: "job1" });
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

});
