
import Logger from "bunyan";
import url from "url";

export const getGitHubConfigurationUrl = (
	githubHost,
	jwt,
	jiraHost
): string =>
	`https://${githubHost}/github/configuration?jwt=${jwt}&xdm_e=${jiraHost}`;

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`;

export const getJiraHostFromRedirectUrl = (urlOrPath: string, log: Logger): string => {
	if (!urlOrPath) {
		return "empty";
	}
	try {
		const { host, query } = url.parse(urlOrPath, true);
		return (query?.xdm_e ? url.parse(query.xdm_e.toString(), false).host : host) || "unknown";
	} catch (err) {
		log.error(err, "Cannot detect jiraHost from redirect URL");
		return "error";
	}
};
