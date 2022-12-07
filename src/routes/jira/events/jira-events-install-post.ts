import { Installation } from "models/installation";
import { Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

/**
 * Handle the install webhook from Jira
 */
export const JiraEventsInstallPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info("Received installation payload");

	const { baseUrl: host, clientKey, sharedSecret } = req.body;
	await Installation.install({
		host,
		clientKey,
		sharedSecret
	});

	req.log.info("Installed installation");

	await saveConfiguredAppProperties(host, undefined, undefined, req.log, false);

	statsd.increment(metricHttpRequest.install);

	res.sendStatus(204);
};
