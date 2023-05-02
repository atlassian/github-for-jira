import { envVars } from "config/env";
const testSites = (envVars.JIRA_TEST_SITES || "").split(",").filter(s => !!s).map(s => s.trim());
export const isTestJiraHost = (jiraHost: string | undefined) => {
	if (!jiraHost) return false;
	return testSites.includes(jiraHost);
};
