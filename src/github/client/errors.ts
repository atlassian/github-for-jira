import { AxiosError } from "axios";

export class GithubClientError extends Error {
	status?: number;
	cause: AxiosError;
	constructor(message: string, cause: AxiosError, status?: number) {
		super(message);
		this.status = status;
		this.cause = { ...cause, config: {} };
	}
}

export class RateLimitingError extends GithubClientError {
	/**
	 * The value of the x-ratelimit-reset header, i.e. the epoch seconds when the rate limit is refreshed.
	 */
	rateLimitReset: number;
	rateLimitRemaining: number;
	constructor(resetEpochSeconds: number, rateLimitRemaining: number, error: AxiosError, status?: number) {
		super("Rate limiting error", error, status);
		this.rateLimitReset = resetEpochSeconds;
		this.rateLimitRemaining = rateLimitRemaining;
	}
}
export class BlockedIpError extends GithubClientError {
	constructor(error: AxiosError, status?: number) {
		super("Blocked by GitHub allowlist", error, status);
	}
}
