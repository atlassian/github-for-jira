import Logger from "bunyan";

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
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`;

// Deprecated, will be removed with the feature flag. Use getJiraHostFromRedirectUrlNew() instead
export const getJiraHostFromRedirectUrl = (url: string): string => {
	try {
		return new URL(url).host;
	} catch (err) {
		return "unknown";
	}
};

export const getJiraHostFromRedirectUrlNew = (url: string, log: Logger): string => {
	if (!url) {
		return "empty";
	}
	try {
		const [_, jiraBaseUrlAndTail] = url.split('&xdm_e=', 2);
		if (jiraBaseUrlAndTail) {
			const [jiraBaseUrlEncoded] = jiraBaseUrlAndTail.split('&');
			const jiraBaseUrl = decodeURIComponent(jiraBaseUrlEncoded);
			if (jiraBaseUrl.startsWith("http") && jiraBaseUrl.indexOf('//') >= 0) {
				const [_, jiraHost] = jiraBaseUrl.split('//');
				return jiraHost;
			}
			return jiraBaseUrl;
		}
		return new URL(url).host;
	} catch (err) {
		log.error(err, "Cannot detect jiraHost from redirect URL");
		return "unknown";
	}
};
