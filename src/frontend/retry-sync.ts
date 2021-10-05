import { Subscription } from "../models";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, syncType } = req.body;
	Sentry.setExtra("Body", req.body);

	req.log.info({ syncType }, "Received sync request");

	try {
		const subscription = await Subscription.getSingleInstallation(res.locals.installation.jiraHost, gitHubInstallationId);
		if(!subscription) {
			req.log.info({
				jiraHost: res.locals.installation.jiraHost,
				installationId: gitHubInstallationId }, "Subscription not found when retrying sync.");
			res.status(404).send("Subscription not found, cannot resync.");
			return;
		}
		await Subscription.findOrStartSync(subscription, syncType);

		res.sendStatus(202);
	} catch (error) {
		next(new Error("Unauthorized"));
	}
};
