import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

const MAX_INSTALLATIONS_BATCH = 50;
/**
 * This will update JIRA APP Properties for the GH4J installation to set isConfigured;
 */
export const ApiConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const jiraHosts = req.body.jiraHosts as string[];
	const gitHubAppId = req.body.gitHubAppId as number;
	const configuredState = req.body.configuredState;

	if (jiraHosts?.length === 0) {
		res.status(400);
		res.send("please provide installation ids to update!");
		return;
	}
	// Upper limit of jorahists per call
	if (jiraHosts.length > MAX_INSTALLATIONS_BATCH) {
		res.status(400);
		res.send(`Calm down Cowboy, keep it under ${MAX_INSTALLATIONS_BATCH} at a time!`);
		return;
	}

	const logger = getLogger("api-sync-configured");
	const tasks = jiraHosts.map(async jiraHost => {
		if (configuredState !== undefined) {
			await saveConfiguredAppProperties(jiraHost, logger, configuredState); return;
		} else {
			// need to confirm that passed in value is configured. Existing on subscription table satisfies this.
			// We could still save isconfiguredstate as false, but null is equivalent so why not save some trees and leave Jira alone
			await saveConfiguredAppProperties(jiraHost, logger, (await Subscription.getAllForHost(jiraHost, gitHubAppId)).length > 0); return;
		}
	});

	try {
		await Promise.all(tasks);
		res.status(200).send({ message: "jiraHosts Updated", jiraHosts });
		logger.info({ jiraHosts }, "jiraHosts updated");
	} catch (err: unknown) {
		logger.info({ err }, "Failed to set jiraHosts configurations");
	}

};
