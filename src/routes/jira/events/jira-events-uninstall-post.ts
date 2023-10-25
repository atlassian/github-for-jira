import { Subscription } from "models/subscription";
import { Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { JiraClient } from "models/jira-client";

/**
 * Handle the uninstall webhook from Jira
 */
export const JiraEventsUninstallPost = async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

	if (subscriptions) {
		await Promise.all(subscriptions.map((sub) => sub.uninstall()));
	}

	statsd.increment(metricHttpRequest.uninstall, {}, { jiraHost: installation.jiraHost });

	const jiraClient = await JiraClient.getNewClient(installation, req.log);

	try {
		await jiraClient.appPropertiesDelete();
	} catch (err: unknown) {
		req.log.warn({ err }, "Cannot delete properties");
	}
	await installation.uninstall();

	req.log.info("App uninstalled on Jira.");
	res.sendStatus(204);
};
