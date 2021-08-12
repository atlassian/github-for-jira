import { ActionFromSubscription, ActionSource, ActionType } from "../../proto/v0/action";
import { submitProto } from "../../tracking";
import { Subscription } from "../../models";
import getJiraClient from "../../jira/client";
import { Request, Response } from "express";

/**
 * Handle the when a user deletes an entry in the UI
 */
export default async (req: Request, res: Response): Promise<void> => {
	const jiraHost = req.session.jiraHost;

	req.log.info("Received delete jira configuration request for jira host %s and installation ID %s",
		jiraHost, req.body.installationId);

	const jiraClient = await getJiraClient(jiraHost, null, req.log);
	(await jiraClient) &&
	jiraClient.devinfo.installation.delete(req.body.installationId);

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		req.body.installationId
	);
	const action = ActionFromSubscription(subscription, res.locals.installation);
	action.type = ActionType.DESTROYED;
	action.actionSource = ActionSource.WEB_CONSOLE;

	await subscription.destroy();
	await submitProto(action);

	res.sendStatus(204);
};
