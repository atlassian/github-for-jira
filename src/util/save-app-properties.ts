import { getJiraClient } from "~/src/jira/client/jira-client";

export const getAppKey = (): string => {
	const instance = process.env.INSTANCE_NAME;
	return `com.github.integration${instance ? `.${instance}` : ""}`;
};

// TYPE YO TODO
export const saveConfiguredAppProperties = async (jiraHost, gitHubInstallationId, gitHubAppId, logger, isConfiguredState) => {
	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, logger);

	try {
		await jiraClient.appProperties.create(isConfiguredState);
	} catch (err) {
		logger.error({ err }, "Set app properties failed");
	}
};


// TODO TYPES YP
export const getConfiguredAppProperties = async (jiraHost, gitHubInstallationId, gitHubAppId, logger) => {
	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, logger);
	try {
		return await jiraClient.appProperties.get();
	} catch (err) {
		logger.error({ err }, "Set app properties failed");
	}
};
