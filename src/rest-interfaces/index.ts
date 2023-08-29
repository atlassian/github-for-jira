
export type GetRedirectUrlResponse = {
	redirectUrl: string;
	state: string;
};

export type ExchangeTokenResponse = {
	accessToken: string;
	refreshToken: string;
};

export type UsersGetAuthenticatedResponse = {
	email: string;
	login: string;
};

export type GetGitHubAppsUrlResponse = {
	appInstallationUrl: string;
}

export type OrganizationsResponse = {
	orgs: Array<GitHubInstallationType>;
}

export type GitHubInstallationType = {
	account: GitHubInstallationAccountType;
	app_id: number;
	requiresSsoLogin: boolean;
	isIPBlocked: boolean;
	isAdmin: boolean;
	id: number;
};

type GitHubInstallationAccountType = {
	avatar_url: string;
	id: number;
	login: string;
	url: string;
	site_admin?: boolean;
	type?: string;
};

export type JiraCloudIDResponse = {
	cloudId: string;
};

export type ErrorType = "warning" | "error";

export type ApiError = {
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
	| "TLS_CONNECTION"
	| "UNKNOWN";
