import { Installation } from "../models";
import { Request, Response } from "express";
import statsd from "../config/statsd";
import { metricHttpRequest } from "../config/metric-names";
import { removeExistingHostFromInstallationsTable } from "./util/removeExistingHostFromDb";

/**
 * Handle the install webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { baseUrl: host, clientKey, sharedSecret } = req.body;

	req.log.info(`Received installation payload for jiraHost: ${host}`);

	// check if an instance of the host already exists in installations table
	removeExistingHostFromInstallationsTable(host, req);

	await Installation.install({
		host,
		clientKey,
		sharedSecret
	});

	req.log.info("Installed installation");

	statsd.increment(metricHttpRequest.install);

	res.sendStatus(204);
};
