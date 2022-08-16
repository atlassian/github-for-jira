import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";

export const ApiInstallationDelete = async (req: Request, res: Response): Promise<void> => {
	const installationId = Number(req.params.installationId);
	const { gitHubAppConfig } = res.locals;
	const jiraHost = req.params.jiraHost;

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId,
		gitHubAppConfig?.gitHubAppId
	);

	if (!subscription) {
		req.log.debug("no subscription");
		res.sendStatus(404);
		return;
	}

	const gitHubInstallationId = subscription.gitHubInstallationId;

	if (!jiraHost || !gitHubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	try {
		const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, req.log);
		req.log.info({ jiraHost, gitHubInstallationId }, `Deleting DevInfo`);
		await jiraClient.devinfo.installation.delete(gitHubInstallationId);
		res.status(200).send(`DevInfo deleted for jiraHost: ${jiraHost} gitHubInstallationId: ${gitHubInstallationId}`);
	} catch (err) {
		res.status(500).json(err);
	}
};
