import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";

export const ApiInstallationDelete = async (req: Request, res: Response): Promise<void> => {
	const githubInstallationId = req.params.installationId;
	const jiraHost = req.params.jiraHost;

	//TODO: ARC-1619 Maybe need to fix this and put it into the path
	//Not doing it now as it might break pollinator if it use this api
	const { gitHubAppIdStr } = req.query;
	const gitHubAppId = parseInt(gitHubAppIdStr as string) || undefined;

	if (!jiraHost || !githubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		Number(githubInstallationId),
		gitHubAppId
	);

	if (!subscription) {
		req.log.debug("no subscription");
		res.sendStatus(404);
		return;
	}

	try {
		const jiraClient = await getJiraClient(jiraHost, Number(githubInstallationId), req.log, gitHubAppId);
		req.log.info({ jiraHost, githubInstallationId }, `Deleting DevInfo`);
		await jiraClient.devinfo.installation.delete(githubInstallationId);
		res.status(200).send(`DevInfo deleted for jiraHost: ${jiraHost} githubInstallationId: ${githubInstallationId}`);
	} catch (err) {
		res.status(500).json(err);
	}
};
