// this will need to be updated later to check for database entry
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/git-hub-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";

export const GITHUB_CLOUD_HOSTNAME = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github.v3+json";

export interface GitHubClientConfig {
	hostname: string;
	baseUrl: string;
}

export async function getGitHubApiUrl(gitHubInstallationId: number, jiraHost: string) {
	const gitHubClientConfig = await getGitHubClientConfig(gitHubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.baseUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

const getGitHubClientConfig = async (gitHubInstallationId: number): Promise<GitHubClientConfig> => {
	const subscription = gitHubInstallationId && await Subscription.getAllForGitHubInstallationId(gitHubInstallationId);
	const gitHubAppId = subscription && subscription?.length && subscription.map(sub => sub.gitHubAppId)[0];
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	const gitHubServerAppBaseUrl = gitHubServerApp && gitHubServerApp.githubBaseUrl;

	return gitHubServerAppBaseUrl
		? {
			hostname: gitHubServerAppBaseUrl,
			baseUrl: gitHubServerAppBaseUrl
		}
		: {
			hostname: GITHUB_CLOUD_HOSTNAME,
			baseUrl: GITHUB_CLOUD_API_BASEURL
		};
};

export async function getGitHubHostname(gitHubInstallationId: number, jiraHost: string) {
	const gitHubClientConfig = await getGitHubClientConfig(gitHubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(githubInstallationId: number, logger: Logger, jiraHost: string): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfig(githubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig.baseUrl)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(githubInstallationId: number, logger: Logger, jiraHost: string): Promise<GitHubInstallationClient> {
	const gitHubClientConfig = await getGitHubClientConfig(githubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubClientConfig.baseUrl), logger, gitHubClientConfig.baseUrl)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(gitHubInstallationId: number, githubToken: string, logger: Logger, jiraHost: string): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfig(gitHubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig.baseUrl)
		: new GitHubUserClient(githubToken, logger);
}


