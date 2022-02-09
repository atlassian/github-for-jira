import {AxiosError, AxiosResponse} from "axios";

export class GithubClientError extends Error {
	status?: number;
	cause?: AxiosError;

	constructor(message: string, status?: number, cause?: AxiosError) {
		super(message);
		this.status = status;
		if(cause) {
			this.cause = {...cause, config: {}};
			this.stack = this.stack?.split("\n").slice(0, 2).join("\n") + "\n" + cause.stack
		}
	}
}

export class GithubClientTimeoutError extends GithubClientError {

	constructor(cause?: AxiosError) {
		super("Timeout", undefined, cause);
	}

}

export class RateLimitingError extends GithubClientError {
	/**
	 * The value of the x-ratelimit-reset header, i.e. the epoch seconds when the rate limit is refreshed.
	 */
	rateLimitReset: number;

	constructor(response: AxiosResponse, cause?: AxiosError) {
		super("Rate limiting error", response.status, cause);
		const rateLimitResetHeaderValue: string = response.headers?.["x-ratelimit-reset"];
		this.rateLimitReset =  parseInt(rateLimitResetHeaderValue) || Date.now() / 1000 + ONE_HOUR_IN_SECONDS;
	}
}

export class BlockedIpError extends GithubClientError {
	constructor(error: AxiosError, status?: number) {
		super("Blocked by GitHub allowlist", status, error);
	}
}

/**
 * Type for errors section in GraphQL response
 */
export type GraphQLError = {
		message: string;
		type: string;
		path?: [string];
		extensions?: {
			[key: string]: any;
		};
		locations?: [
			{
				line: number;
				column: number;
			}
		];
	};

export class GithubClientGraphQLError extends GithubClientError {

	/**
	 * errors section from the GraplQL response
	 */
	errors: GraphQLError[];
	constructor(message: string, errors: GraphQLError[]) {
		super(message);
		this.errors = errors;
	}

}

const ONE_HOUR_IN_SECONDS = 60 * 60;
