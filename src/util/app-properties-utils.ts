import { getJiraClient } from "~/src/jira/client/jira-client";
import Logger from "bunyan";

export const getAppKey = (): string => {
	const instance = process.env.INSTANCE_NAME;
	return `com.github.integration${instance ? `.${instance}` : ""}`;
};

export const saveConfiguredAppProperties = async (jiraHost: string, gitHubInstallationId: number | undefined, gitHubAppId: number | undefined, logger: Logger, isConfiguredState: boolean) => {
	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, logger);

	try {
		await jiraClient.appProperties.create(isConfiguredState);
	} catch (err) {
		logger.error({ err }, "Set app properties failed");
	}
};

export const getConfiguredAppProperties = async (jiraHost: string, gitHubInstallationId: number | undefined, gitHubAppId: number | undefined, logger: Logger) => {
	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, logger);
	try {
		return await jiraClient.appProperties.get();
	} catch (err) {
		logger.error({ err }, "Get app properties failed");
	}
};
