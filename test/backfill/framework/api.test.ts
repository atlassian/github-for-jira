/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import { BackoffRetryStrategy, CappedDelayRateLimitStrategy, RateLimitState } from "../../../src/backfill/framework/api";
import each from "jest-each";

describe("Backfilling API", () => {

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
