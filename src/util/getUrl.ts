import envVars from "../config/env";

export const getGitHubConfigurationUrl = (
	jiraHost
): string =>
	`${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page`;

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	`${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production`;
