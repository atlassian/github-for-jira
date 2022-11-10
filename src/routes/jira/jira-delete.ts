import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { Request, Response } from "express";

type ResponseType =  Response<
	string,
	JiraHostVerifiedLocals
>;
/**
 * Handle the when a user deletes an entry in the UI
 *
 */
export const JiraDelete = async (req: Request, res: ResponseType): Promise<void> => {
	const { jiraHost } = res.locals;
	// TODO: The params `installationId` needs to be replaced by `subscriptionId`
	const gitHubInstallationId = Number(req.params.installationId) || Number(req.body.gitHubInstallationId);
	const gitHubAppId = req.body.appId;

	req.log.debug({ gitHubInstallationId, gitHubAppId }, "Received Jira DELETE subscription request");

	if (!jiraHost) {
		req.log.error("Missing Jira Host");
		res.status(401).send("Missing jiraHost");
		return;
	}

	if (!gitHubInstallationId) {
		req.log.error("Missing Github Installation ID");
		res.status(401).send("Missing Github Installation ID");
		return;
	}

	if (!gitHubAppId) {
		req.log.debug("No gitHubAppId passed. Disconnecting cloud subscription.");
	}

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		gitHubInstallationId,
		gitHubAppId
	);

	if (!subscription) {
		res.status(404).send("Cannot find Subscription");
		return;
	}

	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, req.log);
	await jiraClient.devinfo.installation.delete(gitHubInstallationId);
	await subscription.destroy();

	res.sendStatus(204);
};
