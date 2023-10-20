
export type GetRedirectUrlResponse = {
	redirectUrl: string;
	state: string;
};

export type ExchangeTokenResponse = {
	accessToken: string;
	refreshToken?: string;
};

export type UsersGetAuthenticatedResponse = {
	email: string;
	login: string;
};

export type GetDeferredInstallationUrl = {
	deferredInstallUrl: string;
};

export type OrgOwnershipResponse = {
	orgName: string;
}

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
	| "UNKNOWN";

export type Account = {
	login: string;
	id: number;
	avatar_url: string;
	type?: string;
	site_admin?: boolean;
};

export type SuccessfulConnection = {
	app_slug: string;
	syncWarning: string;
	id: number;
	account: Account;
	repository_selection: string;
	app_id: number;
	target_id: number;
	target_type: string;
	created_at: string;
	updated_at: string;
	syncStatus: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
	isGlobalInstall: boolean;
	backfillSince: string | null;
};

export type FailedCloudConnection = {
	id: number;
	deleted: boolean;
	orgName?: string;
};

export type GhCloudSubscriptions = {
	successfulCloudConnections: SuccessfulConnection[];
	failedCloudConnections: FailedCloudConnection[];
};

export type FailedConnection = {
	id: number;
	deleted: boolean;
	orgName?: string;
};

export type Installation = {
	id: number;
	account: Account;
	target_type: string;
	created_at: string;
	updated_at: string;
	syncStatus: string;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	backfillSince: null | string;
	jiraHost: string;
};

export type GitHubEnterpriseApplication = {
	id: number;
	uuid: string;
	appId: number;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubAppName: string;
	installationId: number;
	createdAt: string;
	updatedAt: string;
	successfulConnections: SuccessfulConnection[];
	failedConnections: FailedConnection[];
	installations: {
		fulfilled: Installation[];
		rejected: any[];
		total: number;
	};
};

export type GhEnterpriseServer = {
	gitHubBaseUrl: string;
	applications: GitHubEnterpriseApplication[];
};

export type GHSubscriptions = {
	ghCloudSubscriptions: GhCloudSubscriptions;
	ghEnterpriseServers: GhEnterpriseServer[];
};
