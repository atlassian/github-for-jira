import { Subscription } from "../models";
import { Request, Response } from "express";
import statsd from "../config/statsd";
import { metricHttpRequest } from "../config/metric-names";
import { removeRepoConfig } from "../config-as-code/repo-config-service";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

/**
 * Handle the uninstall webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

	if (subscriptions) {
		await Promise.all(subscriptions.map((sub) => sub.uninstall()));
	}

	statsd.increment(metricHttpRequest.uninstall);

	await installation.uninstall();

	if (await booleanFlag(BooleanFlags.CONFIG_AS_CODE, false, installation.jiraHost)) {
		await removeRepoConfig(installation.id);
	}

	req.log.info("App uninstalled on Jira.");
	res.sendStatus(204);
};
