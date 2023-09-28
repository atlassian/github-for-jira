import { ApiError, ErrorCode } from "rest-interfaces";

export enum Errors {
	MISSING_JIRA_HOST = "Jira Host url is missing",
	MISSING_GITHUB_TOKEN = "GitHub Auth token is missing",
	MISSING_ISSUE_KEY = "Issue key is missing",
	MISSING_SUBSCRIPTION = "No Subscription found",
	MISSING_GITHUB_APP_CONFIG = "No gitHubAppConfig found",
	IP_ALLOWLIST_MISCONFIGURED = "IP Allowlist Misconfigured",
	MISSING_GITHUB_APP_NAME = "Github App name is missing",
	MISSING_REPOSITORY_ID = "Missing repository ID",
	MISSING_SECURITY_CONTAINER_IDS = "Missing security container IDs",
	REPOSITORY_NOT_FOUND = "Repository not found",
	MISSING_WORKSPACE_ID = "Missing workspace ID",
	MISSING_WORKSPACE_IDS = "Missing workspace IDs",
	UNEXPECTED_REPOSITORY_URL_STRUCTURE = "Repository url structure is unexpected and cannot be opperated on",
	FORBIDDEN_PATH = "Forbidden path"
}

export class UIDisplayableError extends Error {
	httpStatus: number;
	constructor(httpStatus: number, msg: string) {
		super(msg);
		this.httpStatus = httpStatus;
	}
}

export class RestApiError extends Error implements ApiError {
	httpStatus: number;
	errorCode: ErrorCode;
	constructor(httpStatus: number, errorCode: ErrorCode, msg: string) {
		super(msg);
		this.httpStatus = httpStatus;
		this.errorCode = errorCode;
	}
}

export class InvalidArgumentError extends RestApiError {
	constructor(msg: string) {
		super(400, "INVALID_OR_MISSING_ARG", msg);
	}
}

export class InvalidTokenError extends RestApiError {
	constructor(msg: string) {
		super(401, "INVALID_TOKEN", msg);
	}
}

export class InsufficientPermissionError extends RestApiError {
	constructor(msg: string) {
		super(403, "INSUFFICIENT_PERMISSION", msg);
	}
}

