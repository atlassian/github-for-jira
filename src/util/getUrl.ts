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
	`https://${jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`;

export const getJiraHostFromRedirectUrl = (url: string): string => {
	const urlIndex = url.indexOf("https%");
	return urlIndex
		? url.substring(urlIndex, url.length)
		: "unknown Jira instance";
};
