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

	return await booleanFlag(BooleanFlags.GHE_SERVER, true, jiraHost) && gitHubClientConfig
		? `${gitHubClientConfig.baseUrl}`
		: GITHUB_CLOUD_API_BASEURL;
}

const getGitHubClientConfig = async (gitHubInstallationId: number): Promise<GitHubClientConfig> => {
	// will return a separate array for each gh app id
	// TODO check when there are no subscriptions (no connected orgs)
	/* Scenarios:
		1. Only connected to cloud
			- customer has connected to at least one org in cloud.
			- gitHubAppId in Subscriptions is null for each entry
			- easy peasy: this is a cloud customer, let's return the cloud hostname and baseurl
		2. Only connected to server
			- customer has connected to at least one org in their internal instance
			- gitHubAppId in Subscriptions will all have a value (could be the same id or different: depends on whether they choose to use 1 app for their company or multiple)
			- pretty simple: when get 1 gitHubAppId to query the GitHubServerApps table and get the GHE base url (all gitHubAppIds will effectively point to the same url)
		3. I'm a customer that is connected to both cloud AND server
		 - customer has already connected to orgs in both cloud and server
		 - some Subscription entries will have gitHubAppId of null
		 - other Subscritpion entries will have gitHubAppId with a value (again, could be the same for all Sub entries or different)
		 - ???? what do we do here? this function is called in numerous places including the GH oauth router. How do I define which hostname and baseUrl to set?

	*/
	const subscription = await Subscription.getAllForGitHubInstallationId(gitHubInstallationId);
	const gitHubAppId = 1;


	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
	const gitHubServerAppBaseUrl = gitHubServerApp?.githubBaseUrl;

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

	return await booleanFlag(BooleanFlags.GHE_SERVER, true, jiraHost) && gitHubClientConfig
		? gitHubClientConfig.hostname
		: GITHUB_CLOUD_HOSTNAME;
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to
 * get all installation or get more info for the app
 */
export async function createAppClient(githubInstallationId: number, logger: Logger, jiraHost: string): Promise<GitHubAppClient> {
	const gitHubClientConfig = await getGitHubClientConfig(githubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, true, jiraHost)
		? new GitHubAppClient(logger, gitHubClientConfig.baseUrl)
		: new GitHubAppClient(logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app to get
 * information specific to an organization.
 */
export async function createInstallationClient(githubInstallationId: number, logger: Logger, jiraHost: string): Promise<GitHubInstallationClient> {
	const gitHubClientConfig = await getGitHubClientConfig(githubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, true, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, gitHubClientConfig.baseUrl), logger, gitHubClientConfig.baseUrl)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(gitHubInstallationId: number, githubToken: string, logger: Logger, jiraHost: string): Promise<GitHubUserClient> {
	const gitHubClientConfig = await getGitHubClientConfig(gitHubInstallationId);
	return await booleanFlag(BooleanFlags.GHE_SERVER, true, jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubClientConfig.baseUrl)
		: new GitHubUserClient(githubToken, logger);
}


