// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/git-hub-server-app";

export const GITHUB_ENTERPRISE_CLOUD_BASEURL = "https://github.com";

export const getGitHubBaseUrl = async (jiraHost: string): Promise<string | undefined> => {
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;
	const gitHubServerApp = gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);

	return gitHubServerApp ? gitHubServerApp?.githubBaseUrl : undefined;
}

export const setGitHubBaseUrl = (gitHubBaseUrl: string | undefined): string => {
	return gitHubBaseUrl ? `${gitHubBaseUrl}/api/v3` : "https://api.github.com";
}

export const setAcceptHeader = (gitHubBaseUrl: string | undefined): string => {
	return gitHubBaseUrl ? "application/vnd.github.machine-man-preview+json" : "application/vnd.github.v3+json";
}
