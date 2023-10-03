import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";

export const ApiInstallationSyncPost = async (req: Request, res: Response): Promise<void> => {
	const githubInstallationId = Number(req.params.installationId);
	const gitHubAppId = Number(req.params.gitHubAppId) || undefined;

	req.log.debug({ body: req.body }, "Sync body");
	const { jiraHost, resetType } = req.body;

	try {
		req.log.info(jiraHost, githubInstallationId);
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			githubInstallationId,
			gitHubAppId
		);

		if (!subscription) {
			res.sendStatus(404);
			return;
		}

		await findOrStartSync(subscription, req.log, resetType, undefined, undefined, { source: "api-installation-sync" });

		res.status(202).json({
			message: `Successfully (re)started sync for ${githubInstallationId}`
		});
	} catch (err: unknown) {
		req.log.info(err);
		res.sendStatus(401);
	}
};
