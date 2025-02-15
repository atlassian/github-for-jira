export type RestSyncReqBody = {
	syncType: string;
	source: string;
	commitsFromDate: string;
}

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

export type DeferredInstallationUrlParams = {
	gitHubInstallationId: number;
	gitHubOrgName: string;
};

export type BackfillStatusUrlParams = {
	subscriptionIds: string;
};

export type DeferralParsedRequest = {
	orgName: string;
	jiraHost: string;
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

export type CheckAdminOrgSource = "ErrorInOrgList" | "DeferredInstallationModal";

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
	reqTraceId: string | undefined;
	message: string;
	errorCode: ErrorCode;
}

export type StateCallbacksForDefaultDeferredState = {
	setIsLoading: (x: boolean) => void;
	setForbidden: (x: boolean) => void;
	onPopupBlocked: () => void;
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
	| "INVALID_DEFERRAL_REQUEST_ID"
	| "JIRAHOST_MISMATCH"
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
	html_url: string;
	subscriptionId: number;
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
		rejected: unknown[];
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

export type BackfillPageModalTypes = "BACKFILL" | "DISCONNECT_SUBSCRIPTION" | "DISCONNECT_SERVER_APP" | "DISCONNECT_SERVER" | "DELETE_GHE_APP";

export type ConnectionSyncStatus = "IN PROGRESS" | "FINISHED" | "PENDING" | "FAILED";

export type SubscriptionBackfillState = {
	id: number;
	totalRepos?: number;
	syncedRepos: number;
	syncStatus: ConnectionSyncStatus;
	isSyncComplete: boolean;
	backfillSince?: string;
	failedSyncErrors?: Record<string, number>;
	syncWarning?: string;
	gitHubAppId?: number;
};

export type BackfillStatusError = {
	subscriptionId: string;
	error: string;
};
export type BackFillType = {
	[key: string]: SubscriptionBackfillState;
};

export type BackfillStatusResp = {
	subscriptions: BackFillType;
	isBackfillComplete: boolean;
	subscriptionIds: Array<number>;
	errors: BackfillStatusError;
};
