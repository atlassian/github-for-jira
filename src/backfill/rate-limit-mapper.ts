import { AxiosResponse } from "axios";
import { RateLimitState } from "./looper/api";

/**
 * Maps the response headers from GitHub to a RateLimitState object.
 */
export const toRateLimitState = (response: AxiosResponse): RateLimitState | undefined => {

	const rateLimitRemaining = Number(response.headers["X-RateLimit-Remaining"]);
	const refreshDateInSeconds = Number(response.headers["X-RateLimit-Reset"]);

	if (!rateLimitRemaining || !refreshDateInSeconds) {
		return undefined;
	}

	return {
		budgetLeft: rateLimitRemaining,
		refreshDate: new Date(refreshDateInSeconds * 1000)
	}
}
