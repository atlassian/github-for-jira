interface UrlParams {
	githubHost: string;
	jwt: string;
	jiraHost: string;
}

export const getGitHubConfigurationUrl = (urlParams: UrlParams): string => {
	const { githubHost, jwt, jiraHost } = urlParams;

	return `https://${githubHost}/github/configuration?jwt=${jwt}&xdm_e=${jiraHost}`;
};

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.productio`;

export const getJiraHostFromRedirectUrl = (url: string): string => {
	try {
		return new URL(url).host;
	} catch (err) {
		return "unknown";
	}
};
