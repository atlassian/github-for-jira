// this will need to be updated later to check for database entry
import { Installation } from "models/installation";
import {getLogger} from "config/logger";
const logger = getLogger("github.installation.client");

export const GITHUB_ENTERPRISE_CLOUD_BASEURL = "https://github.com";

export const getGitHubBaseUrl = async (jiraHost: string): Promise<string> => {
	const installation = await Installation.getForHost(jiraHost);
	const gitHubAppId = installation?.githubAppId;

	const baseUrl = gitHubAppId ? "http://github.internal.atlassian.com" : GITHUB_ENTERPRISE_CLOUD_BASEURL;
	logger.info("baseUrl", baseUrl)
	return baseUrl;
}

export const setGitHubBaseUrl = (gitHubBaseUrl: string | undefined): string => {
	logger.info("Setting gitHubBaseUrl", gitHubBaseUrl)
	const baseUrl = gitHubBaseUrl ? `${gitHubBaseUrl}/api/v3` : "https://api.github.com";
	logger.info("BASE URL", baseUrl)
	return baseUrl;
}

export const setAcceptHeader = (gitHubBaseUrl: string | undefined): string => {
	logger.info("Setting header", gitHubBaseUrl);
	const header = gitHubBaseUrl ? "application/vnd.github.machine-man-preview+json" : "application/vnd.github.v3+json";
	logger.info("HEADER", header);
	return header;
}
