import { Request, Response } from "express";
import { RepoSyncState, Subscription } from "../../../models";

export const ApiInstallationSyncstateGet = async (req: Request, res: Response): Promise<void> => {
	const githubInstallationId = Number(req.params.installationId);
	const jiraHost = req.params.jiraHost;

	if (!jiraHost || !githubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	try {
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			githubInstallationId
		);

		if (!subscription) {
			res.status(404).send(`No Subscription found for jiraHost "${jiraHost}" and installationId "${githubInstallationId}"`);
			return;
		}

		res.json(await RepoSyncState.toRepoJson(subscription));
	} catch (err) {
		res.status(500).json(err);
	}
};
