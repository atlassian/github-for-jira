import { Subscription } from "models/subscription";
import { Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { getAppKey } from "utils/save-app-properties";

/**
 * Handle the uninstall webhook from Jira
 */
export const JiraEventsUninstallPost = async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

	if (subscriptions) {
		await Promise.all(subscriptions.map((sub) => sub.uninstall()));
	}

	statsd.increment(metricHttpRequest.uninstall);

	const jiraClient = await getJiraClient(installation.jiraHost, undefined, undefined, req.log);
	const appKey = getAppKey();
	await jiraClient.appProperties.delete(appKey);

	await installation.uninstall();

	req.log.info("App uninstalled on Jira.");
	res.sendStatus(204);
};
