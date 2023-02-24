import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import Logger from "bunyan";

export class GithubClientError extends Error {
	cause: AxiosError;
	isRetryable = true;

	status?: number;
	code?: string;

	constructor(message: string, cause: AxiosError) {
		super(message);

		this.cause = { ...cause };
		this.stack = this.stack?.split("\n").slice(0, 2).join("\n") + "\n" + cause.stack;
		this.status = this.cause.response?.status;
		this.code = this.cause.code;
	}
}

export class GithubClientTimeoutError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Timeout", cause);
	}
}

export class RateLimitingError extends GithubClientError {
	/**
	 * The value of the x-ratelimit-reset header, i.e. the epoch seconds when the rate limit is refreshed.
	 */
	rateLimitReset: number;

	constructor(response: AxiosResponse, cause: AxiosError) {
		super("Rate limiting error", cause);
		const rateLimitResetHeaderValue: string = response.headers?.["x-ratelimit-reset"];
		this.rateLimitReset = parseInt(rateLimitResetHeaderValue) || Date.now() / 1000 + ONE_HOUR_IN_SECONDS;
		this.isRetryable = false;
	}
}

export class BlockedIpError extends GithubClientError {
	constructor(error: AxiosError) {
		super("Blocked by GitHub allowlist", error);
		this.isRetryable = false;
	}
}

export class InvalidPermissionsError extends GithubClientError {
	constructor(error: AxiosError) {
		super("Resource not accessible by integration", error);
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
		code?: string;
		timestamp?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	locations?: [
		{
			line: number;
			column: number;
		}
	];
};

export const buildAxiosStubErrorForGraphQlErrors = (config: AxiosRequestConfig<any>, response: AxiosResponse) => {
	return {
		name: "GraphQLError",
		message: "GraphQLError(s)",
		config,
		response,
		isAxiosError: true
	} as AxiosError;
};

export class GithubClientGraphQLError extends GithubClientError {

	/**
	 * errors section from the GraplQL response
	 */
	errors: GraphQLError[];

	constructor(config: AxiosRequestConfig<any>, response: AxiosResponse, errors: GraphQLError[]) {
		super(
			errors[0].message + (errors.length > 1 ? ` and ${errors.length - 1} more errors` : ""),
			buildAxiosStubErrorForGraphQlErrors(config, response)
		);
		this.errors = errors;
		this.isRetryable = !!errors?.find(
			(error) =>
				"MAX_NODE_LIMIT_EXCEEDED" == error.type ||
				error.message?.startsWith("Something went wrong while executing your query")
		);
	}
}

export const isChangedFilesError = (logger: Logger, err: GithubClientGraphQLError | GithubClientError): boolean => {
	const bool = err instanceof GithubClientGraphQLError || !(err instanceof RateLimitingError || err instanceof GithubClientTimeoutError);
	logger.warn({ isChangedFilesError: bool , error: err }, "isChangedFilesError");
	return bool;
	// return !!err?.errors?.find(e => e.message?.includes("changedFiles"));
};

const ONE_HOUR_IN_SECONDS = 60 * 60;
