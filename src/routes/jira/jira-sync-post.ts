import { Subscription } from "models/subscription";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";

export const JiraSyncPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, syncType, commitsFromDate } = req.body;

	console.log('commitsFromDatecommitsFromDatecommitsFromDatecommitsFromDate');
	console.log('commitsFromDatecommitsFromDatecommitsFromDatecommitsFromDate');
	console.log('commitsFromDatecommitsFromDatecommitsFromDatecommitsFromDate');
	console.log('commitsFromDatecommitsFromDatecommitsFromDatecommitsFromDate');
	console.log('commitsFromDatecommitsFromDatecommitsFromDatecommitsFromDate');
	console.log(commitsFromDate);
	Sentry.setExtra("Body", req.body);

	req.log.info({ syncType }, "Received sync request");

	try {
		const subscription = await Subscription.getSingleInstallation(res.locals.installation.jiraHost, gitHubInstallationId);
		if (!subscription) {
			req.log.info({
				jiraHost: res.locals.installation.jiraHost,
				installationId: gitHubInstallationId
			}, "Subscription not found when retrying sync.");
			res.status(404).send("Subscription not found, cannot resync.");
			return;
		}
		const newdate = commitsFromDate ? new Date(commitsFromDate) : undefined;

		if (newdate && newdate.valueOf() > Date.now()){
			res.status(400).send("Invalid date, please select historical date!");
			return;
		}

		await findOrStartSync(subscription, req.log, syncType, newdate);

		res.sendStatus(202);
	} catch (error) {
		next(new Error("Unauthorized"));
	}
};
