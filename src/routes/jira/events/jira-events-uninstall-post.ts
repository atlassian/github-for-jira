import { Subscription } from "models/subscription";
import { Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";

type ResponseType =  Response<
	never,
	JiraJwtVerifiedLocals
>;
/**
 * Handle the uninstall webhook from Jira
 */
export const JiraEventsUninstallPost = async (req: Request, res: ResponseType): Promise<void> => {
	const { installation } = res.locals;
	const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

	if (subscriptions) {
		await Promise.all(subscriptions.map((sub) => sub.uninstall()));
	}

	statsd.increment(metricHttpRequest.uninstall);

	await installation.uninstall();

	req.log.info("App uninstalled on Jira.");
	res.sendStatus(204);
};
