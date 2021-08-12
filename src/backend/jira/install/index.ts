import { ActionFromInstallation, ActionSource, ActionType } from "../../proto/v0/action";
import { submitProto } from "../../tracking";
import { Installation } from "../../models";
import { Request, Response } from "express";
import statsd from "../../../config/statsd";
import { metricHttpRequest } from "../../../config/metric-names";

/**
 * Handle the install webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	req.log.info("Received installation payload");

	const { baseUrl: host, clientKey, sharedSecret } = req.body;
	const installation =
		Installation &&
		(await Installation.install({
			host,
			clientKey,
			sharedSecret
		}));

	req.log.info("Installed installtion with ID %d for host %s", installation.id, host);

	const action = await ActionFromInstallation(installation);
	action.type = ActionType.CREATED;
	action.actionSource = ActionSource.WEBHOOK;

	statsd.increment(metricHttpRequest().install);

	res.sendStatus(204);
	await submitProto(action);
};
