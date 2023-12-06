import { Errors } from "config/errors";
import { Request, Response } from "express";
import { removeSubscription } from "utils/jira-utils";

/**
 * Handle the when a user deletes an entry in the UI
 *
 */
export const JiraDelete = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, installation } = res.locals;
	// TODO: The params `installationId` needs to be replaced by `subscriptionId`
	const gitHubInstallationId = Number(req.params.installationId) || Number(req.body.gitHubInstallationId);
	const gitHubAppId = req.body.appId;
	req.log.info({ gitHubInstallationId, gitHubAppId }, "Received Jira DELETE subscription request");

	if (!jiraHost) {
		req.log.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}

	if (!gitHubInstallationId) {
		req.log.error("Missing Github Installation ID");
		res.status(401).send("Missing Github Installation ID");
		return;
	}

	if (!gitHubAppId) {
		req.log.info("No gitHubAppId passed. Disconnecting cloud subscription.");
	}
	await removeSubscription(installation, gitHubInstallationId, gitHubAppId, req.log, res, undefined);
};
