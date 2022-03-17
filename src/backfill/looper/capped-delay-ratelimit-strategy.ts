/**
 * Calculates a delay with a hard upper limit. Can be used in combination with SQS queues, for example, because
 * they only allow a max delay of 15 minutes.
 */
import { RateLimitState, RateLimitStrategy } from "../backfill.types";

export class CappedDelayRateLimitStrategy implements RateLimitStrategy {

	private readonly maxDelayInSeconds: number;
	private readonly now: () => Date;

	// TODO: clean up now function messiness - only used or testing
	constructor(maxDelayInSeconds: number, now?: () => Date) {
		this.maxDelayInSeconds = maxDelayInSeconds;
		this.now = now
			? now
			: () => new Date();
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
