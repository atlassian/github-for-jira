
export interface GetRedirectUrlResponse {
	redirectUrl: string;
	state: string;
}

export interface ExchangeTokenResponse {
	accessToken: string;
	refreshToken: string;
}

export interface UsersGetAuthenticatedResponse {
	email: string;
	login: string;
}

export interface GetGitHubAppsUrlResponse {
	appInstallationUrl: string;
}

export interface OrganizationsResponse {
	orgs: GitHubInstallationType[];
}

export interface GitHubInstallationType {
	account: GitHubInstallationAccountType;
	app_id: number;
	requiresSsoLogin: boolean;
	isIPBlocked: boolean;
	isAdmin: boolean;
	id: number;
}

interface GitHubInstallationAccountType {
	avatar_url: string;
	id: number;
	login: string;
	url: string;
	site_admin?: boolean;
	type?: string;
}

export interface JiraCloudIDResponse {
	cloudId: string;
}

export type ErrorType = "warning" | "error";

export interface ApiError {
	message: string;
	errorCode: ErrorCode;
}

//DO NOT USE ENUM as webpack can't handler anything none "type"
//ts-load is not a real typescript compile, it only strips off the types, hence cannot process Enum/Class/etc
export type ErrorCode =
	| "INVALID_OR_MISSING_ARG"
	| "INVALID_TOKEN"
	| "INSUFFICIENT_PERMISSION"
	| "RATELIMIT"
	| "TIMEOUT"
	| "IP_BLOCKED"
	| "SSO_LOGIN"
	| "RESOURCE_NOT_FOUND"
	| "UNKNOWN";
