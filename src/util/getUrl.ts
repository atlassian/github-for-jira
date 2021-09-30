interface IUrlParams {
	githubHost: string;
	jwt: string;
	jiraHost: string;
}

export const getGitHubConfigurationUrl = (urlParams: IUrlParams): string => {
	const { githubHost, jwt, jiraHost } = urlParams;

	return `https://${githubHost}/github/configuration?jwt=${jwt}&xdm_e=${jiraHost}`;
};

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover/app/com.github.integration.production#!/discover/app/com.github.integration.production`;

export const getJiraHostFromRedirectUrl = (url: string): string => {
	try {
		return new URL(url).host;
	} catch (err) {
		return "unknown";
	}
};
