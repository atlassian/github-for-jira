// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/git-hub-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan"
import { GitHubAppClient } from "../github/client/github-app-client";

export const GITHUB_CLOUD_HOSTNAME = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_CLOUD_ACCEPT_HEADER = "application/vnd.github.v3+json"

export interface GitHubClientConfig {
	hostname: string;
	apiBaseUrl: string;
	acceptHeader: string;
}

export async function getGitHubApiUrl(jiraHost: string) {
	const gitHubClientConfig = await getGitHubClientConfig(jiraHost);

	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.apiBaseUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

export async function getGitHubHostname(jiraHost: string) {
	const gitHubClientConfig = await getGitHubClientConfig(jiraHost);

	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

const getGitHubClientConfig = async (jiraHost: string): Promise<GitHubClientConfig> => {
	// TODO: remove duplicate jiraHosts and find issue that causes duplicates
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);

	return gitHubServerApp
		? {
			hostname: gitHubServerApp?.githubBaseUrl,
			apiBaseUrl: `${gitHubServerApp?.githubBaseUrl}/api/v3`,
			acceptHeader:  "application/vnd.github.machine-man-preview+json"
		}
		: {
			hostname: GITHUB_CLOUD_HOSTNAME,
			apiBaseUrl: "https://api.github.com",
			acceptHeader: "application/vnd.github.v3+json"
		}
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(logger: Logger, jiraHost: string): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfig(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(githubInstallationId: number, jiraHost: string, logger: Logger): Promise<GitHubInstallationClient> {
	const gitHubClientConfig = await getGitHubClientConfig(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubClientConfig.apiBaseUrl), logger, gitHubClientConfig)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(githubToken: string, jiraHost: string, logger: Logger): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfig(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig)
		: new GitHubUserClient(githubToken, logger);
}



