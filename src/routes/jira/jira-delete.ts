import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { Request, Response } from "express";

/**
 * Handle the when a user deletes an entry in the UI
 */
export const JiraDelete = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost } = res.locals;
	const installationId = Number(req.params.installationId);

	if (!jiraHost) {
		req.log.error("Missing Jira Host");
		res.status(401).send("Missing jiraHost in body");
		return;
	}

	if (!installationId) {
		req.log.error("Missing Github Installation ID");
		res.status(401).send("Missing Github Installation ID in params");
		return;
	}

	req.log.info({ installationId }, "Received delete jira configuration request");

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	if (!subscription) {
		res.status(404).send("Cannot find Subscription");
		return;
	}

	const jiraClient = await getJiraClient(jiraHost, installationId, req.log);
	await jiraClient.devinfo.installation.delete(installationId);
	await subscription.destroy();

	res.sendStatus(204);
};
