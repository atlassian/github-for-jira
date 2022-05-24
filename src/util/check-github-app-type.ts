// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/git-hub-server-app";
import {GitHubInstallationClient} from "~/src/github/client/github-installation-client";
import {getCloudInstallationId} from "~/src/github/client/installation-id";
import {booleanFlag, BooleanFlags} from "config/feature-flags";
import {GitHubUserClient} from "~/src/github/client/github-user-client";
import Logger from "bunyan"

export const GITHUB_ENTERPRISE_CLOUD_BASEURL = "https://github.com";

// TODO: make this function private as soon as all usages have been refactored to one of the factory functions below
export const getGitHubBaseUrl = async (jiraHost: string): Promise<string> => {
	// TODO: the getForHost function returns first created installation for the given jiraHost
	// and we have duplicates in the database for some reason. This will cause an issue sooner
	// or later (not for github.com users, but for GitHub Server users)
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);

	return gitHubServerApp ? gitHubServerApp?.githubBaseUrl : GITHUB_ENTERPRISE_CLOUD_BASEURL;
}

export const setGitHubBaseUrl = (gitHubBaseUrl: string | undefined): string => {
	return gitHubBaseUrl ? `${gitHubBaseUrl}/api/v3` : "https://api.github.com";
}

export const setAcceptHeader = (gitHubBaseUrl: string | undefined): string => {
	return gitHubBaseUrl ? "application/vnd.github.machine-man-preview+json" : "application/vnd.github.v3+json";
}

/**
 * Factory function to create a GitHub client that authenticates as the installation of our GitHub app.
 */
export async function createInstallationClient(githubInstallationId: number, jiraHost: string, logger: Logger): Promise<GitHubInstallationClient> {
	const githubBaseUrl = await getGitHubBaseUrl(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
		? new GitHubInstallationClient(getCloudInstallationId(githubInstallationId, githubBaseUrl), logger, githubBaseUrl)
		: new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), logger);
}

/**
 * Factory function to create a GitHub client that authenticates as the user (with a user access token).
 */
export async function createUserClient(githubToken: string, jiraHost: string, logger: Logger): Promise<GitHubUserClient> {
	const githubBaseUrl = await getGitHubBaseUrl(jiraHost);
	return await booleanFlag(BooleanFlags.GHE_SERVER_AUTH_AND_CONNECT_FLOW, false, jiraHost)
		? new GitHubUserClient(githubToken, logger, githubBaseUrl)
		: new GitHubUserClient(githubToken, logger);
}
