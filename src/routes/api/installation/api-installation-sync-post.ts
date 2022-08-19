import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";

export const ApiInstallationSyncPost = async (req: Request, res: Response): Promise<void> => {
	const githubInstallationId = Number(req.params.installationId);
	req.log.debug({ body: req.body }, "Sync body");
	const { jiraHost, resetType } = req.body;

	//TODO: ARC-1619 Maybe need to fix this and put it into the path
	//Not doing it now as it might break pollinator if it use this api
	const { gitHubAppIdStr } = req.query;

	try {
		req.log.info(jiraHost, githubInstallationId);
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			githubInstallationId,
			parseInt(gitHubAppIdStr as string) || undefined
		);

		if (!subscription) {
			res.sendStatus(404);
			return;
		}

		await findOrStartSync(subscription, req.log, resetType);

		res.status(202).json({
			message: `Successfully (re)started sync for ${githubInstallationId}`
		});
	} catch (err) {
		req.log.info(err);
		res.sendStatus(401);
	}
};
