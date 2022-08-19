import { GitHubServerApp } from "models/github-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId } from "../github/client/installation-id";
import { booleanFlag, BooleanFlags, GHE_SERVER_GLOBAL } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";
import { envVars } from "~/src/config/env";
import * as PrivateKey from "probot/lib/private-key";
import { keyLocator } from "~/src/github/client/key-locator";

export const GITHUB_CLOUD_HOSTNAME = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github.v3+json";

export interface GitHubClientConfig {
	serverId?: number;
	hostname: string;
	baseUrl: string;
	apiUrl: string;
	appId: number;
	privateKey: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
}

export async function getGitHubApiUrl(jiraHost: string, gitHubAppId: number) {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.apiUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

export const getGitHubClientConfigFromAppId = async (gitHubAppId: number | undefined, jiraHost?: string): Promise<GitHubClientConfig> => {
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	if (gitHubServerApp) {
		return	{
			serverId: gitHubServerApp.id,
			hostname: gitHubServerApp.gitHubBaseUrl,
			baseUrl: gitHubServerApp.gitHubBaseUrl,
			apiUrl: `${gitHubServerApp.gitHubBaseUrl}/api/v3`,
			appId: gitHubServerApp.appId,
			gitHubClientId: gitHubServerApp.gitHubClientId,
			gitHubClientSecret: await gitHubServerApp.decrypt("gitHubClientSecret"),
			privateKey: await gitHubServerApp.decrypt("privateKey")
		};
	}
	// cloud config
	const privateKey = await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)? await keyLocator(): PrivateKey.findPrivateKey();
	if (!privateKey) {
		throw new Error("Private key not found for github cloud");
	}
	return {
		hostname: GITHUB_CLOUD_HOSTNAME,
		baseUrl: GITHUB_CLOUD_API_BASEURL,
		apiUrl: GITHUB_CLOUD_API_BASEURL,
		appId: parseInt(envVars.APP_ID),
		gitHubClientId: envVars.GITHUB_CLIENT_ID,
		gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
		privateKey: privateKey
	};
};

export async function getGitHubHostname(jiraHost: string, gitHubAppId: number) {
	const gitHubClientConfig = gitHubAppId && await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(logger: Logger, jiraHost: string, gitHubAppId: number | undefined): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig.baseUrl, gitHubClientConfig.appId.toString(), gitHubClientConfig.privateKey)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(gitHubInstallationId: number, jiraHost: string, logger: Logger, gitHubAppId?: number | undefined): Promise<GitHubInstallationClient> {

	if (await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)) {
		const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
		return new GitHubInstallationClient(getInstallationId(gitHubInstallationId, gitHubClientConfig.baseUrl, gitHubClientConfig.appId), logger, gitHubClientConfig.baseUrl, gitHubClientConfig.serverId);
	} else {
		return new GitHubInstallationClient(getInstallationId(gitHubInstallationId), logger);
	}
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(githubToken: string, jiraHost: string, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig.baseUrl)
		: new GitHubUserClient(githubToken, logger);
}
