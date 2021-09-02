import { Subscription } from "../models";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, syncType } = req.body;
	Sentry.setExtra("Body", req.body);

	req.log.info({ syncType }, "Received sync request");

	try {
		const subscription = await Subscription.getSingleInstallation(res.locals.installation.jiraHost, gitHubInstallationId);

		await Subscription.findOrStartSync(subscription, syncType);

		res.sendStatus(202);
		next();
	} catch (error) {
		next(new Error("Unauthorized"));
	}
};
