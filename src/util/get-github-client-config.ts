import { GitHubServerApp } from "models/github-server-app";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getInstallationId } from "../github/client/installation-id";
import { getAppTokenKey } from "../github/client/app-token-key";
import { booleanFlag, BooleanFlags, GHE_SERVER_GLOBAL, stringFlag, StringFlags } from "config/feature-flags";
import { GitHubUserClient } from "../github/client/github-user-client";
import Logger from "bunyan";
import { GitHubAppClient } from "../github/client/github-app-client";
import { envVars } from "~/src/config/env";
import { GitHubConfig } from "~/src/github/client/github-client";
import { GitHubAnonymousClient } from "~/src/github/client/github-anonymous-client";

export const GITHUB_CLOUD_HOSTNAME = "github.com";
export const GITHUB_CLOUD_BASEURL = "https://github.com";
export const GITHUB_CLOUD_API_BASEURL = "https://api.github.com";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github.v3+json";

interface GitHubClientConfig extends GitHubConfig {
	gitHubAppId?: number;
	appId: number;
	gitHubClientId: string;
}

export const getGitHubApiUrl = async (jiraHost: string, gitHubAppId: number | undefined, logger: Logger) => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, logger, jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.apiUrl}`
		: GITHUB_CLOUD_API_BASEURL;
};

/**
 * Decides whether to use the proxy URL and which one if so.
 *
 * @param jiraHost - jiraHost from context
 * @param gitHubBaseUrl - for cloud, either undefined or "github.com"'s base url
 * @param logger
 *
 * @return proxy URL or undefined (do not use)
 */
const calculateProxyBaseUrl = async (jiraHost: string, gitHubBaseUrl: string | undefined, logger: Logger): Promise<string | undefined> => {
	if (gitHubBaseUrl && gitHubBaseUrl != GITHUB_CLOUD_BASEURL) {
		const skipList = await stringFlag(StringFlags.OUTBOUND_PROXY_SKIPLIST, "", jiraHost);
		let skipOutboundProxy: boolean;
		try {
			skipOutboundProxy = skipList
				.split(",")
				.filter(hostname => !!hostname)
				.map(hostname => hostname.trim())
				.map(hostname => hostname.indexOf("://") >= 0 ? hostname : "http://" + hostname)
				.map(hostname => new URL(hostname).hostname.toLowerCase())
				.indexOf(new URL(gitHubBaseUrl).hostname.trim().toLowerCase()) >= 0;
		} catch (err) {
			logger.error({ err }, "Cannot evaluate skiplist because of a error, opting for outboundproxy for good");
			skipOutboundProxy = false;
		}
		if (skipOutboundProxy) {
			logger.warn("Skip outbound proxy");
			return undefined;
		}
	}
	logger.info("Use outbound proxy");
	return envVars.PROXY;
};

const buildGitHubServerConfig = async (githubServerBaseUrl: string, jiraHost: string, logger: Logger): Promise<GitHubConfig> => {
	return {
		hostname: githubServerBaseUrl,
		baseUrl: githubServerBaseUrl,
		apiUrl: `${githubServerBaseUrl}/api/v3`,
		graphqlUrl: `${githubServerBaseUrl}/api/graphql`,
		proxyBaseUrl: await calculateProxyBaseUrl(jiraHost, githubServerBaseUrl, logger)
	};
};

const buildGitHubCloudConfig = async (jiraHost: string, logger: Logger): Promise<GitHubConfig> => {
	return {
		hostname: GITHUB_CLOUD_HOSTNAME,
		baseUrl: GITHUB_CLOUD_BASEURL,
		apiUrl: GITHUB_CLOUD_API_BASEURL,
		graphqlUrl: `${GITHUB_CLOUD_API_BASEURL}/graphql`,
		proxyBaseUrl: await calculateProxyBaseUrl(jiraHost, undefined, logger)
	};
};

const buildGitHubClientServerConfig = async (gitHubServerApp: GitHubServerApp, jiraHost: string, logger: Logger): Promise<GitHubClientConfig> => (
	{
		...(await buildGitHubServerConfig(gitHubServerApp.gitHubBaseUrl, jiraHost, logger)),
		gitHubAppId: gitHubServerApp.id,
		appId: gitHubServerApp.appId,
		gitHubClientId: gitHubServerApp.gitHubClientId
	}
);

const buildGitHubClientCloudConfig = async (jiraHost: string, logger: Logger): Promise<GitHubClientConfig> => {
	return {
		...(await buildGitHubCloudConfig(jiraHost, logger)),
		appId: parseInt(envVars.APP_ID),
		gitHubClientId: envVars.GITHUB_CLIENT_ID
	};
};

export const getGitHubClientConfigFromAppId = async (gitHubAppId: number | undefined, logger: Logger, jiraHost: string): Promise<GitHubClientConfig> => {
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	if (gitHubServerApp) {
		return buildGitHubClientServerConfig(gitHubServerApp, jiraHost, logger);
	}
	return buildGitHubClientCloudConfig(jiraHost, logger);
};

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export const createAppClient = async (logger: Logger, jiraHost: string, gitHubAppId: number | undefined): Promise<GitHubAppClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, logger, jiraHost);
	const appTokenKey = getAppTokenKey(gitHubClientConfig.baseUrl, gitHubClientConfig.appId);
	return new GitHubAppClient(gitHubClientConfig, appTokenKey, gitHubAppId, logger);
};

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export const createInstallationClient = async (gitHubInstallationId: number, jiraHost: string, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubInstallationClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, logger, jiraHost);
	if (await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)) {
		return new GitHubInstallationClient(getInstallationId(gitHubInstallationId, gitHubClientConfig.baseUrl, gitHubClientConfig.appId), gitHubClientConfig, logger, gitHubClientConfig.gitHubAppId);
	} else {
		return new GitHubInstallationClient(getInstallationId(gitHubInstallationId), gitHubClientConfig, logger);
	}
};

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export const createUserClient = async (githubToken: string, jiraHost: string, logger: Logger, gitHubAppId: number | undefined): Promise<GitHubUserClient> => {
	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, logger, jiraHost);
	return new GitHubUserClient(githubToken, gitHubClientConfig, logger);
};

export const createAnonymousClient = async (gitHubBaseUrl: string, jiraHost: string, logger: Logger): Promise<GitHubAnonymousClient> => {
	return new GitHubAnonymousClient(await buildGitHubServerConfig(gitHubBaseUrl, jiraHost, logger));
};

export const createAnonymousClientByGitHubAppId = async (gitHubAppId: number, jiraHost: string, logger: Logger): Promise<GitHubAnonymousClient> => {
	const config = await getGitHubClientConfigFromAppId(gitHubAppId, logger, jiraHost);
	return new GitHubAnonymousClient(config);
};
