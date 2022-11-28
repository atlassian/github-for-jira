import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { getConfiguredAppProperties } from "utils/save-app-properties";
import { Subscription } from "models/subscription";

/**
 * Makes a request to Jira to get jiraHosts is-configured app property
 */
export const ApiConfiguredGet = async (req: Request, res: Response): Promise<void> => {

	const logger = getLogger("api-configured-get");
	const installationId = req.params.installationId as unknown as number;

	const subscription = await Subscription.findOneForGitHubInstallationId(installationId, undefined);

	if (!subscription) {
		res.status(404).send("Subscription not found");
		return;
	}

	const { jiraHost, gitHubInstallationId, gitHubAppId } = subscription;
	const isConfigured = await getConfiguredAppProperties(jiraHost, gitHubInstallationId, gitHubAppId, logger);

	const configStatus = isConfigured.data;
	res.status(200).send({ configStatus });
};
