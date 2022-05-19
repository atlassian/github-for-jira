// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import { envVars } from "config/env";

export const getGitHubBaseUrl = async (jiraHost: string): Promise<string> => {
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;

	// TODO - if gitHubAppId query GitHubServerApps table to get githubBaseUrl
	return gitHubAppId ? "http://github.internal.atlassian.com" : envVars.GITHUB_HOSTNAME;

}

export const setGitHubBaseUrl = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === envVars.GITHUB_HOSTNAME ? "https://api.github.com" : `${gitHubBaseUrl}/api/v3`
}

export const setAcceptHeader = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === envVars.GITHUB_HOSTNAME ? "application/vnd.github.v3+json" : "application/vnd.github.machine-man-preview+json";
}
