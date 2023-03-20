import Logger from "bunyan";
import { JiraClient } from "models/jira-client";
import { Installation } from "models/installation";

export const getAppKey = (): string => {
	const instance = process.env.INSTANCE_NAME;
	return `com.github.integration${instance ? `.${instance}` : ""}`;
};

export const saveConfiguredAppProperties = async (jiraHost: string, logger: Logger, isConfiguredState: boolean) => {
	const installation = await Installation.getForHost(jiraHost);
	if (!installation) {
		logger.error("Cannot access app properties without shared secret");
		return;
	}
	const jiraClient = await JiraClient.getNewClient(installation, logger);

	try {
		await jiraClient.appPropertiesCreate(isConfiguredState);
	} catch (err) {
		// Doing best effort but don't blow things up if it fails
		logger.error({ err }, "Set app properties failed");
	}
};

export const getConfiguredAppProperties = async (jiraHost: string, logger: Logger) => {
	const installation = await Installation.getForHost(jiraHost);
	if (!installation) {
		logger.error("Cannot access app properties without shared secret");
		throw new Error("No installation");
	}

	const jiraClient = await JiraClient.getNewClient(installation, logger);
	try {
		return await jiraClient.appPropertiesGet();
	} catch (err) {
		logger.error({ err }, "Get app properties failed");
		return undefined;
	}
};
