export const getGitHubConfigurationUrl = (
	githubHost,
	jwt,
	jiraHost
): string =>
	`https://${githubHost}/github/configuration?jwt=${jwt}&xdm_e=${jiraHost}`;

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`;

export const getJiraHostFromRedirectUrl = (url: string): string => {
	try {
		return new URL(url).host;
	} catch (err) {
		return "unknown";
	}
};
