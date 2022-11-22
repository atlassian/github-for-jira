import { getJiraClient } from "~/src/jira/client/jira-client";

export const getAppKey = (): string => {
	const instance = process.env.INSTANCE_NAME;
	return `com.github.integration${instance ? `.${instance}` : ""}`;
};

export const saveConfiguredAppProperties = async (jiraHost, gitHubInstallationId, gitHubAppId, req, isConfiguredState) => {
	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, req.log);

	try {
		await jiraClient.appProperties.create(isConfiguredState);
	} catch (err) {
		req.log.error({ err }, "Set app properties failed");
	}
};
