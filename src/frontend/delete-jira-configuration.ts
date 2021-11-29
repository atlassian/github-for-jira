import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import { Request, Response } from "express";

/**
 * Handle the when a user deletes an entry in the UI
 */
export default async (req: Request, res: Response): Promise<void> => {
	const jiraHost = req.body.jiraHost;
	if(!jiraHost) {
		req.log.error("Missing Jira Host");
		res.status(401).send("Missing jiraHost in body");
		return;
	}

	req.log.info({ installationId: req.body.installationId }, "Received delete jira configuration request");

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		req.body.installationId
	);

	if(!subscription) {
		res.status(404).send("Cannot find Subscription");
		return;
	}

	const jiraClient = await getJiraClient(jiraHost, req.body.installationId, req.log);
	await jiraClient.devinfo.installation.delete(req.body.installationId);
	await subscription.destroy();

	res.sendStatus(204);
};
