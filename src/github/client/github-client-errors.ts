import { AxiosError, AxiosResponse } from "axios";
import { ErrorCode } from "rest-interfaces";
import safeJsonStringify from "safe-json-stringify";

const safeParseResponseBody = (data: unknown): string | undefined => {
	if (data === undefined) return undefined;
	if ((typeof data) === "string") {
		return data as string;
	}
	if ((typeof data) === "object") {
		return safeJsonStringify(data as object);
	}
	return String(data);
};

export class GithubClientError extends Error {
	cause: AxiosError;
	isRetryable = true;

	status?: number;
	code?: string;
	resBody?: string;
	uiErrorCode: ErrorCode;

	constructor(message: string, cause: AxiosError) {
		super(message);

		this.status = cause.response?.status;
		this.code = cause.code;
		this.resBody = safeParseResponseBody(cause.response?.data);
		this.uiErrorCode = "UNKNOWN";

		this.cause = { ...cause };
		this.stack = (this.stack?.split("\n").slice(0, 2).join("\n") ?? "Missing Stack") + "\n" + (cause.stack ?? "Missing Stack");
	}
}

export class GithubClientTimeoutError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Timeout", cause);
		this.uiErrorCode = "TIMEOUT";
	}
}

export class GithubClientRateLimitingError extends GithubClientError {
	/**
	 * The value of the x-ratelimit-reset header, i.e. the epoch seconds when the rate limit is refreshed.
	 */
	rateLimitReset: number;

	constructor(cause: AxiosError) {
		super("Rate limiting error", cause);
		this.uiErrorCode = "RATELIMIT";
		const rateLimitResetHeaderValue: string = cause.response?.headers?.["x-ratelimit-reset"] || "";
		this.rateLimitReset = parseInt(rateLimitResetHeaderValue) || ((Date.now() / 1000) + ONE_HOUR_IN_SECONDS);
		this.isRetryable = false;
	}
}

export class GithubClientBlockedIpError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Blocked by GitHub allowlist", cause);
		this.uiErrorCode = "IP_BLOCKED";
		this.isRetryable = false;
	}
}

export class GithubClientSSOLoginError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("SSO Login required", cause);
		this.uiErrorCode = "SSO_LOGIN";
	}
}

export class GithubClientInvalidPermissionsError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Resource not accessible by integration", cause);
		this.uiErrorCode = "INSUFFICIENT_PERMISSION";
	}
}

export class GithubClientNotFoundError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Not found", cause);
		this.uiErrorCode = "RESOURCE_NOT_FOUND";
	}
}

export class GithubClientCommitNotFoundBySHAError extends GithubClientError {
	constructor(cause: AxiosError) {
		super("Commit not found by sha", cause);
		this.uiErrorCode = "RESOURCE_NOT_FOUND";
	}
}


/**
 * Type for errors section in GraphQL response
 */
export type GraphQLError = {
	message: string;
	type: string;
	path?: string[];
	extensions?: {
		code?: string;
		timestamp?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	locations?:
	{
		line: number;
		column: number;
	}[];
};

export const buildAxiosStubErrorForGraphQlErrors = (response: AxiosResponse) => {
	return {
		name: "GraphQLError",
		message: "GraphQLError(s)",
		config: response.config,
		response,
		request: response.request,
		isAxiosError: true
	} as AxiosError;
};

export class GithubClientGraphQLError extends GithubClientError {

	/**
	 * errors section from the GraplQL response
	 */
	errors: GraphQLError[];

	constructor(response: AxiosResponse, errors: GraphQLError[]) {
		super(
			errors[0].message + (errors.length > 1 ? ` and ${errors.length - 1} more errors` : ""),
			buildAxiosStubErrorForGraphQlErrors(response)
		);
		this.errors = errors;
		this.uiErrorCode = "UNKNOWN";
		this.isRetryable = !!errors.find(
			(error) =>
				"MAX_NODE_LIMIT_EXCEEDED" == error.type ||
				error.message?.startsWith("Something went wrong while executing your query")
		);
	}

	isChangedFilesError(): boolean {
		return !!this.errors.find(err => err.message.includes("changedFiles"));
	}
}

const ONE_HOUR_IN_SECONDS = 60 * 60;
