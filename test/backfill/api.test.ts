/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import { BackoffRetryStrategy } from "../../src/backfill/api";
import each from "jest-each";

describe("Backfilling API", () => {

	describe("BackoffRetryStrategy", () => {

		each([
			[3, 0, true, 2],
			[3, 1, true, 4],
			[3, 2, true, 8],
			[3, 3, true, 16],
			[3, 4, true, 32],
			[3, 5, false, 64],
			[3, 6, false, 128],
		]).it("input: retries=%s, failed attempts=%s; output: shouldRetry=%s, delay=%s", async (retries: number, failedAttempts: number, expectedToRetry: boolean, expectedDelay: boolean) => {
			const backoffStrategy = new BackoffRetryStrategy(retries, 2, 2);
			expect(backoffStrategy.getRetry(failedAttempts).shouldRetry).toBe(expectedToRetry);
			expect(backoffStrategy.getRetry(failedAttempts).retryAfterSeconds).toBe(expectedDelay);
		});

	});

});
