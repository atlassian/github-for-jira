export class RateLimitingError extends Error {
	/**
	 * The value of the x-ratelimit-reset header, i.e. the epoch seconds when the rate limit is refreshed.
	 */
	rateLimitReset: number;

	constructor(resetEpochSeconds: number) {
		super("rate limiting error");
		this.rateLimitReset = resetEpochSeconds;
		Object.setPrototypeOf(this, RateLimitingError.prototype);
	}
}
