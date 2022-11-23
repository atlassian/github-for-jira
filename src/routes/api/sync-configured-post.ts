import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { saveConfiguredAppProperties } from "utils/save-app-properties";

// This will update JIRA APP Properties for the GH4J installation to set isConfigured;
export const ApiSyncConfigured = async (req: Request, res: Response): Promise<void> => {
	const jiraHosts = req.body.jiraHosts as string[];

	if (jiraHosts?.length === 0) {
		res.status(400).send("please provide jiraHosts to update!");
		return;
	}
	// Upper limit of jirahosts per call
	if (jiraHosts.length > 50) {
		res.status(400).send("Calm down Cowboy, keep it under 500 at a time!");
		return;
	}

	const logger = getLogger("api-sync-configured");
	const tasks = jiraHosts.map(jiraHost => {
		// need to confirm that passed in value is configured. Existing on subscription table satisfies this.
		const subscription = Subscription.getSingleInstallation(jiraHost);
		// We could still save isconfiguredstate as false, but null is equivalent so why not save some trees and leave Jira alone
		if (!subscription) {
			return;
		}
		return saveConfiguredAppProperties(jiraHost, undefined, undefined, logger, true);
	});

	try {
		const results = await Promise.all(tasks);
		logger.info({ results }, "Jirahost configurations set");
	} catch (err) {
		logger.info({ err }, "Failed to set Jirahost configurations");
	}

};
