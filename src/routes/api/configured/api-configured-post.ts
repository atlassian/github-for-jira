import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

const MAX_INSTALLATIONS_BATCH = 50;
/**
 * This will update JIRA APP Properties for the GH4J installation to set isConfigured;
 */
export const ApiConfiguredPost = async (req: Request, res: Response): Promise<void> => {
	const installationIds = req.body.installationIds as number[];

	if (installationIds?.length === 0) {
		res.status(400);
		res.send("please provide installation ids to update!");
		return;
	}
	// Upper limit of installationIds per call
	if (installationIds.length > MAX_INSTALLATIONS_BATCH) {
		res.status(400);
		res.send(`Calm down Cowboy, keep it under ${MAX_INSTALLATIONS_BATCH} at a time!`);
		return;
	}

	const logger = getLogger("api-sync-configured");
	const tasks = installationIds.map(async installationId => {
		// need to confirm that passed in value is configured. Existing on subscription table satisfies this.
		const subscription = await Subscription.findOneForGitHubInstallationId(installationId, undefined);
		// We could still save isconfiguredstate as false, but null is equivalent so why not save some trees and leave Jira alone
		if (!subscription) {
			return;
		}
		const { jiraHost, gitHubAppId } = subscription;
		return await saveConfiguredAppProperties(jiraHost, installationId, gitHubAppId, logger, true);
	});

	try {
		await Promise.all(tasks);
		res.status(200).send({ message: "Installations Updated", installationIds });
		logger.info({ installationIds }, "Installations updated");
	} catch (err) {
		logger.info({ err }, "Failed to set Installations configurations");
	}

};
