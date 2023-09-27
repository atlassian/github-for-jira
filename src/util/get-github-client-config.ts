import { GitHubServerApp } from "models/github-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId } from "../github/client/installation-id";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";
import { envVars } from "~/src/config/env";
import { keyLocator } from "~/src/github/client/key-locator";
import { GitHubClientApiKeyConfig, GitHubConfig, Metrics } from "~/src/github/client/github-client";
import { GitHubAnonymousClient } from "~/src/github/client/github-anonymous-client";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL, GITHUB_CLOUD_HOSTNAME } from "~/src/github/client/github-client-constants";

interface GitHubClientConfig extends GitHubConfig {
	serverId?: number;
	appId: number;
	privateKey: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
}

const buildGitHubServerConfig = (githubServerBaseUrl: string, apiKeyConfig?: GitHubClientApiKeyConfig): GitHubConfig => {
	return {
		hostname: githubServerBaseUrl,
		baseUrl: githubServerBaseUrl,
		apiUrl: `${githubServerBaseUrl}/api/v3`,
		graphqlUrl: `${githubServerBaseUrl}/api/graphql`,
		proxyBaseUrl: envVars.PROXY,
		apiKeyConfig
	};
};

const buildGitHubCloudConfig = (): GitHubConfig => {
	return {
		hostname: GITHUB_CLOUD_HOSTNAME,
		baseUrl: GITHUB_CLOUD_BASEURL,
		apiUrl: GITHUB_CLOUD_API_BASEURL,
		graphqlUrl: `${GITHUB_CLOUD_API_BASEURL}/graphql`,
		proxyBaseUrl: envVars.PROXY
	};
};

const buildGitHubClientServerConfig = async (gitHubServerApp: GitHubServerApp, jiraHost: string): Promise<GitHubClientConfig> => (
	{
		...(
			buildGitHubServerConfig(gitHubServerApp.gitHubBaseUrl,
				gitHubServerApp.apiKeyHeaderName
					? {
						headerName: gitHubServerApp.apiKeyHeaderName,
						apiKeyGenerator: () => gitHubServerApp.getDecryptedApiKeyValue(jiraHost)
					}
					: undefined
			)
		),
		serverId: gitHubServerApp.id,
		appId: gitHubServerApp.appId,
		gitHubClientId: gitHubServerApp.gitHubClientId,
		gitHubClientSecret: await gitHubServerApp.getDecryptedGitHubClientSecret(jiraHost),
		privateKey: await gitHubServerApp.getDecryptedPrivateKey(jiraHost)
	}
);

const buildGitHubClientCloudConfig = async (jiraHost: string | undefined): Promise<GitHubClientConfig> => {
	const privateKey = await keyLocator(undefined, jiraHost);

	if (!privateKey) {
		throw new Error("Private key not found for github cloud");
	}
	return {
		... buildGitHubCloudConfig(),
		appId: parseInt(envVars.APP_ID),
		gitHubClientId: envVars.GITHUB_CLIENT_ID,
		gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
		privateKey: privateKey
	};
};

// TODO: make private because it is only exported for testing (and must not be used in other places!)
export const getGitHubClientConfigFromAppId = async (gitHubAppId: number | undefined, jiraHost: string | undefined): Promise<GitHubClientConfig> => {
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	if (gitHubServerApp) {
		if (!jiraHost) throw new Error("Missing jiraHost when getGitHubClientConfigFromAppId for GHE");
		return buildGitHubClientServerConfig(gitHubServerApp, jiraHost);
	}
	return buildGitHubClientCloudConfig(jiraHost);
};

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export const createAppClient = async (logger: Logger, jiraHost: string, gitHubAppId: number | undefined, metrics: Metrics): Promise<GitHubAppClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return new GitHubAppClient(gitHubClientConfig, jiraHost, metrics, logger, gitHubClientConfig.appId.toString(), gitHubClientConfig.privateKey);
};

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export const createInstallationClient = async (gitHubInstallationId: number, jiraHost: string, metrics: Metrics, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubInstallationClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return new GitHubInstallationClient(getInstallationId(gitHubInstallationId, gitHubClientConfig.baseUrl, gitHubClientConfig.appId), gitHubClientConfig, jiraHost, metrics, logger, gitHubClientConfig.serverId);
};

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export const createUserClient = async (githubToken: string, jiraHost: string, metrics: Metrics, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubUserClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return new GitHubUserClient(githubToken, gitHubClientConfig, jiraHost, metrics, logger);
};

export const createAnonymousClient = (
	gitHubBaseUrl: string,
	jiraHost: string | undefined,
	metrics: Metrics,
	logger: Logger,
	apiKeyConfig?: GitHubClientApiKeyConfig
): GitHubAnonymousClient =>
	new GitHubAnonymousClient(buildGitHubServerConfig(gitHubBaseUrl, apiKeyConfig), jiraHost, metrics, logger);

export const createAnonymousClientByGitHubAppId = async (gitHubAppId: number | undefined, jiraHost: string | undefined, metrics: Metrics, logger: Logger): Promise<GitHubAnonymousClient> => {
	const config = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return new GitHubAnonymousClient(config, jiraHost, metrics, logger);
};
