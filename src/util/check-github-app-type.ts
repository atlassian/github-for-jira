// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/git-hub-server-app";
import {GitHubInstallationClient} from "~/src/github/client/github-installation-client";
import {getCloudInstallationId} from "~/src/github/client/installation-id";
import {booleanFlag, BooleanFlags} from "config/feature-flags";
import {GitHubUserClient} from "~/src/github/client/github-user-client";
import Logger from "bunyan"
import { GitHubAppClient } from "../github/client/github-app-client";

export const GITHUB_ENTERPRISE_CLOUD_BASEURL = "https://github.com";

export interface GitHubEnterpriseUrls {
	baseUrl: string;
	acceptHeader: string;
}

export async function getGitHubApiUrl() {
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);

	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost) && gitHubBaseUrl
		? `${gitHubBaseUrl}/api/v3`
		: "https://api.github.com";
}

export async function getGitHubHostname() {
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);

	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost) && gitHubBaseUrl
		? gitHubBaseUrl
		: GITHUB_ENTERPRISE_CLOUD_BASEURL;
}

// TODO: make this function private as soon as all usages have been refactored to one of the factory functions below
export const getGitHubBaseUrl = async (jiraHost: string): Promise<GitHubEnterpriseUrls> => {
	// TODO: the getForHost function returns first created installation for the given jiraHost
	// and we have duplicates in the database for some reason. This will cause an issue sooner
	// or later (not for github.com users, but for GitHub Server users)
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);

	return gitHubServerApp
		? {
			baseUrl: gitHubServerApp?.githubBaseUrl,
			acceptHeader:  "application/vnd.github.machine-man-preview+json"
		}
		: {
			baseUrl: GITHUB_ENTERPRISE_CLOUD_BASEURL,
			acceptHeader: "application/vnd.github.v3+json\""
		}
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(logger: Logger, jiraHost: string): Promise<GitHubAppClient> {
	const gitHubEnterprise = await getGitHubBaseUrl(jiraHost);

	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
		? new GitHubAppClient(logger, gitHubEnterprise)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(githubInstallationId: number, jiraHost: string, logger: Logger): Promise<GitHubInstallationClient> {
	const gitHubEnterprise = await getGitHubBaseUrl(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubEnterprise.baseUrl), logger, gitHubEnterprise)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(githubToken: string, jiraHost: string, logger: Logger): Promise<GitHubUserClient> {
	const gitHubEnterprise = await getGitHubBaseUrl(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubEnterprise)
		: new GitHubUserClient(githubToken, logger);
}



