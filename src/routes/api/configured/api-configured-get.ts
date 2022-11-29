import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { getConfiguredAppProperties } from "utils/app-properties-utils";
import { Subscription } from "models/subscription";

/**
 * Makes a request to Jira to get jiraHosts is-configured app property
 */
export const ApiConfiguredGet = async (req: Request, res: Response): Promise<void> => {

	const logger = getLogger("api-configured-get");
	const installationId = req.params.installationId as unknown as number;

	if (!installationId) {
		req.log.warn("no installationId");
		res.sendStatus(400);
		return;
	}

	const subscription = await Subscription.findOneForGitHubInstallationId(installationId, undefined);
	if (!subscription) {
		req.log.warn("no subscription");
		res.sendStatus(404);
		return;
	}

	const { jiraHost, gitHubInstallationId, gitHubAppId } = subscription;
	const isConfigured = await getConfiguredAppProperties(jiraHost, gitHubInstallationId, gitHubAppId, logger);
	const configStatus = isConfigured.data;
	res.status(200);
	res.send({ configStatus });
};
