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
