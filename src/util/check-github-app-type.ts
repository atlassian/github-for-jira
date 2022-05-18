// this will need to be updated later to check for database entry
import {Installation} from "models/installation";

export const isGitHubEnterpriseApp = (jiraHost: string): string | null => {
	// call Installation getGitHubAppIdForHost
	// const installation = await Installation.getForHost(jiraHost);

	// then get the githubappid from the installtion
	// then query to the GSA table to get url


	// call GitHubServerApps -> get all info for that id
	// return !gitHubBaseUrl ? "http://github.internal.atlassian.com" | null;
	return "http://github.internal.atlassian.com";
	// baseUrl -> app url e.g
	// accept headers -> just need to know if an app url exists (could check for null
}


export const setGitHubBaseUrl = (jiraHost: string): string => {
	return !!isGitHubEnterpriseApp(jiraHost) ? `${isGitHubEnterpriseApp(jiraHost)}/api/v3` : "https://api.github.com";
}

export const setAcceptHeader = (jiraHost: string): string => {
	return !!isGitHubEnterpriseApp(jiraHost) ? "application/vnd.github.machine-man-preview+json" : "application/vnd.github.v3+json";
}
