// this will need to be updated later to check for database entry
import {Installation} from "models/installation";
import {envVars} from "config/env";

export const getGitHubBaseUrl = async (jiraHost: string): Promise<string> => {
	// call Installation getGitHubAppIdForHost
	const installation = await Installation.getForHost(jiraHost);

	// add check for !installation
	const gitHubAppId = installation?.githubAppId;

	// then query to the GSA table to get url
	// call GitHubServerApps -> get all info for that id
	// return !gitHubBase 097.rl ? "http://github.internal.atlassian.com" | null;
	return !gitHubAppId ? "http://github.internal.atlassian.com" : envVars.GITHUB_HOSTNAME;
	// baseUrl -> app url e.g
	// accept headers -> just need to know if an app url exists (could check for null
}

export const setGitHubBaseUrl = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === envVars.GITHUB_HOSTNAME ? "https://api.github.com" : `${gitHubBaseUrl}/api/v3`
	// return !!isGitHubEnterpriseApp(jiraHost) ? `${isGitHubEnterpriseApp(jiraHost)}/api/v3` : "https://api.github.com";
}

export const setAcceptHeader = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === envVars.GITHUB_HOSTNAME ? "application/vnd.github.v3+json" : "application/vnd.github.machine-man-preview+json";
	// return !!isGitHubEnterpriseApp(jiraHost) ? "application/vnd.github.machine-man-preview+json" : "application/vnd.github.v3+json";
}
