// this will need to be updated later to check for database entry
import { Installation } from "models/installation";

export const GITHUB_ENTERPRISE_CLOUD_BASEURL = "https://github.com";

export const getGitHubBaseUrl = async (jiraHost: string): Promise<string> => {
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;

	// TODO - if gitHubAppId query GitHubServerApps table to get githubBaseUrl
	return gitHubAppId ? "http://github.internal.atlassian.com" : GITHUB_ENTERPRISE_CLOUD_BASEURL;

}

export const setGitHubBaseUrl = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === GITHUB_ENTERPRISE_CLOUD_BASEURL ? "https://api.github.com" : `${gitHubBaseUrl}/api/v3`
}

export const setAcceptHeader = (gitHubBaseUrl: string): string => {
	return gitHubBaseUrl === GITHUB_ENTERPRISE_CLOUD_BASEURL ? "application/vnd.github.v3+json" : "application/vnd.github.machine-man-preview+json";
}
