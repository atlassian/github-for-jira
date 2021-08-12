import { ActionFromInstallation, ActionFromSubscription, ActionSource, ActionType } from "../backend/proto/v0/action";
import { submitProto } from "../tracking";
import { Subscription } from "../backend/models";
import { Request, Response } from "express";
import statsd from "../config/statsd";
import { metricHttpRequest } from "../config/metric-names";

/**
 * Handle the uninstall webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const subscriptions = await Subscription.getAllForHost(installation.jiraHost);

	const actions = [];
	const action = await ActionFromInstallation(installation);
	action.type = ActionType.DESTROYED;
	action.actionSource = ActionSource.WEBHOOK;
	actions.push(action);

	if (subscriptions) {
		await Promise.all(subscriptions.map(async (subscription) => {
			const subAction = ActionFromSubscription(subscription, installation);
			subAction.type = ActionType.DESTROYED;
			subAction.actionSource = ActionSource.WEBHOOK;
			await subscription.uninstall();
			actions.push(subAction);
		}));
	}

	statsd.increment(metricHttpRequest().uninstall);

	await installation.uninstall();
	await submitProto(actions);

	req.log.info("App uninstalled on Jira. Uninstalling id=%d, Jira Host: %s",
		installation.id, installation.jiraHost);
	res.sendStatus(204);
};
