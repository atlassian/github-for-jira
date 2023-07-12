import { Octokit } from "@octokit/rest";

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

export type OrganizationsResponse = {
	orgs: Array<Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem>;
}
