// this will need to be updated later to check for database entry
import { GitHubServerApp } from "models/github-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";
import { Subscription } from "../models/subscription";

export const GITHUB_CLOUD_HOSTNAME = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github.v3+json";

export interface GitHubClientConfig {
	hostname: string;
	baseUrl: string;
}

export async function getGitHubApiUrl(gitHubAppId: number, jiraHost: string) {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId);

	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.baseUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

const getGitHubClientConfigFromGitHubInstallationId = async (gitHubInstallationId: number): Promise<GitHubClientConfig> => {
	const subscription = await Subscription.findOneForGitHubInstallationId(gitHubInstallationId);
	const gitHubAppId = subscription?.gitHubAppId;

	if (!gitHubAppId) {
		throw new Error("No GitHubAppId found.");
	}

	return getGitHubClientConfigFromAppId(gitHubAppId);
};

const getGitHubClientConfigFromAppId = async (gitHubAppId: number | undefined): Promise<GitHubClientConfig> => {
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);

	if (!gitHubServerApp) {
		throw new Error("No GitHubServerApp found.");
	}

	const gitHubServerAppBaseUrl = gitHubServerApp.gitHubBaseUrl;

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

export async function getGitHubHostname(gitHubAppId: number, jiraHost: string) {
	const gitHubClientConfig = gitHubAppId && await getGitHubClientConfigFromAppId(gitHubAppId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(gitHubAppId: number | undefined, logger: Logger, jiraHost: string): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig.baseUrl)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(githubInstallationId: number, logger: Logger, jiraHost: string): Promise<GitHubInstallationClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromGitHubInstallationId(githubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubClientConfig.baseUrl), logger, gitHubClientConfig.baseUrl)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(gitHubAppId: number | undefined, githubToken: string, logger: Logger, jiraHost: string): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig.baseUrl)
		: new GitHubUserClient(githubToken, logger);
}



