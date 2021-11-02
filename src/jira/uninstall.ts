import { Request, Response } from "express";
import statsd from "../config/statsd";
import { metricHttpRequest } from "../config/metric-names";
import {
	removeExistingHostFromInstallationsTable,
	removeExistingHostFromSubscriptionsTable,
} from "./util/removeExistingHostFromDb";

/**
 * Handle the uninstall webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const { jiraHost } = installation;

	// remove any existing installations from the installations table
	removeExistingHostFromInstallationsTable(jiraHost, req);

	// remove subscriptions from the subscriptions table
	removeExistingHostFromSubscriptionsTable(jiraHost);

	statsd.increment(metricHttpRequest.uninstall);

	await installation.uninstall();

	req.log.info("App uninstalled on Jira.");
	res.sendStatus(204);
};
