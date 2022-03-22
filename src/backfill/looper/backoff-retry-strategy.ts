import { Retry, RetryStrategy } from "../backfill.types";

/**
 * A RetryStrategy that simply retries a fix number of times.
 */
export class BackoffRetryStrategy implements RetryStrategy {

	private readonly retries: number;
	private readonly initialDelayInSeconds: number;
	private readonly backoffMultiplier: number;
	private readonly maxDelayInSeconds = Number.MAX_SAFE_INTEGER;

	constructor(retries: number, initialDelayInSeconds: number, backoffMultiplier: number, maxDelayInSeconds?: number) {
		if (retries < 0) {
			throw new Error("retries must be greater than 0");
		}

		if (backoffMultiplier < 0) {
			throw new Error("backoffMultiplier must be greater than 0");
		}

		if (initialDelayInSeconds < 0) {
			throw new Error("initialDelayInSeconds must be greater than 0");
		}

		if (maxDelayInSeconds && maxDelayInSeconds < 0) {
			throw new Error("maxDelayInSeconds must be greater than 0");
		}

		if (maxDelayInSeconds) {
			this.maxDelayInSeconds = maxDelayInSeconds;
		}

		this.retries = retries;
		this.backoffMultiplier = backoffMultiplier;
		this.initialDelayInSeconds = initialDelayInSeconds;
	}

	getRetry(failedAttempts: number): Retry {
		return {
			shouldRetry: failedAttempts <= this.retries,
			retryAfterSeconds: Math.min(this.maxDelayInSeconds, this.initialDelayInSeconds * Math.pow(this.backoffMultiplier, failedAttempts))
		};
	}
}
