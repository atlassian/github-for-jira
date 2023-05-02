import { Installation } from "models/installation";
import { Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricHttpRequest } from "config/metric-names";

/**
 * Handle the install webhook from Jira
 */
export const JiraEventsInstallPost = async (req: Request, res: Response): Promise<void> => {

	const { baseUrl: host, clientKey, sharedSecret } = req.body;
	req.log.info({ jiraHost: host, clientKey },  "Received installation payload");

	await Installation.install({
		host,
		clientKey,
		sharedSecret
	});

	req.log.info({ jiraHost: host, clientKey },  "Installed installation");

	statsd.increment(metricHttpRequest.install, {}, { jiraHost: host });

	res.sendStatus(204);
};
