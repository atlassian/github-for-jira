import envVars from "../config/env";

export const getJiraAppUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page` : "";

export const getJiraMarketplaceUrl = (jiraHost: string): string =>
	jiraHost?.length ? `${jiraHost}/plugins/servlet/ac/com.atlassian.jira.emcee/discover#!/discover/app/com.github.integration.production` : "";
