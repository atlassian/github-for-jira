import { GitHubServerApp } from "models/github-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId } from "../github/client/installation-id";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";
import { Subscription } from "models/subscription";
import { envVars } from "~/src/config/env";
import * as PrivateKey from "probot/lib/private-key";
import { keyLocator } from "~/src/github/client/key-locator";

export const GITHUB_CLOUD_HOSTNAME = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github.v3+json";

export interface GitHubClientConfig {
	hostname: string;
	baseUrl: string;
	appId: number;
	privateKey: string;
}

export async function getGitHubApiUrl(jiraHost: string, gitHubAppId: number) {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.baseUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

const getGitHubClientConfigFromGitHubInstallationId = async (gitHubInstallationId: number): Promise<GitHubClientConfig> => {
	const subscription = await Subscription.findOneForGitHubInstallationId(gitHubInstallationId);
	const gitHubAppId = subscription?.gitHubAppId;
	return getGitHubClientConfigFromAppId(gitHubAppId, subscription?.jiraHost);
};

const getGitHubClientConfigFromAppId = async (gitHubAppId: number | undefined, jiraHost?: string): Promise<GitHubClientConfig> => {
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	if (gitHubServerApp) {
		return	{
			hostname: gitHubServerApp.gitHubBaseUrl,
			baseUrl: gitHubServerApp.gitHubBaseUrl,
			appId: gitHubServerApp.appId,
			privateKey: await gitHubServerApp.decrypt("privateKey")
		};
	}
	// cloud config
	const privateKey = await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)? await keyLocator(): PrivateKey.findPrivateKey();
	if (!privateKey) {
		throw new Error("Private key not found for github cloud");
	}
	return {
		hostname: GITHUB_CLOUD_HOSTNAME,
		baseUrl: GITHUB_CLOUD_API_BASEURL,
		appId: parseInt(envVars.APP_ID),
		privateKey: privateKey
	};
};

export async function getGitHubHostname(jiraHost: string, gitHubAppId: number) {
	const gitHubClientConfig = gitHubAppId && await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(logger: Logger, jiraHost: string, gitHubAppId: number | undefined): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig.baseUrl, gitHubClientConfig.appId.toString(), gitHubClientConfig.privateKey)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(gitHubInstallationId: number, jiraHost: string, logger: Logger): Promise<GitHubInstallationClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromGitHubInstallationId(gitHubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubInstallationClient(getInstallationId(gitHubInstallationId, gitHubClientConfig.baseUrl, gitHubClientConfig.appId), logger, gitHubClientConfig.baseUrl)
		: new GitHubInstallationClient(getInstallationId(gitHubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(githubToken: string, jiraHost: string, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig.baseUrl)
		: new GitHubUserClient(githubToken, logger);
}
