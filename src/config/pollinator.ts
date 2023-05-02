export const STAGE_POLLINATOR_JIRA_HOST = "https://fusion-arc-pollinator-staging-app.atlassian.net";
export const PROD_POLLINATOR_JIRA_HOST = "https://fusion-pollinator.atlassian.net";
export const isPollinatorSite = (jiraHost: string | undefined) => {
	return jiraHost === STAGE_POLLINATOR_JIRA_HOST || jiraHost === PROD_POLLINATOR_JIRA_HOST;
};
