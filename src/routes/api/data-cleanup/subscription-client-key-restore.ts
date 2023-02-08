import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { QueryTypes } from "sequelize";
import { Subscription } from "models/subscription";
import { Installation } from "models/installation";
import safeJsonStringify from "safe-json-stringify";
import { getHashedKey } from "models/sequelize";

const log = getLogger("SubscriptionJiraClientKeyRestorePost");

export const SubscriptionJiraClientKeyRestorePost = async (req: Request, res: Response): Promise<void> => {

	const maxSubscriptionId = Number(req.query.maxSubscriptionId) || -1;
	log.info({ maxSubscriptionId }, `About to restore subscriptions jira client key (from double hashed)`);

	let currentSubscriptionId: number | undefined;
	try {

		const doubleHashedSubscriptions  = await getDoubleHashedSubscriptions(maxSubscriptionId);
		log.info(`Found ${doubleHashedSubscriptions.length} suscriptions within ${maxSubscriptionId} that doesn't have matching jiraClientKey from Installations table`);

		let successCount = 0;
		for (const subscription of doubleHashedSubscriptions) {
			currentSubscriptionId = subscription.id;
			const success = await tryAndRestoreSubscriptionClientKey(subscription);
			if (success) successCount++;
		}

		log.info({ success: successCount, total: doubleHashedSubscriptions.length, maxSubscriptionId }, `Subscriptions double hashed key restored finished`);

		res.status(200).end(`Successfully replace ${successCount} subscriptions with total ${doubleHashedSubscriptions.length} subscriptions on maxSubscriptionId ${maxSubscriptionId}`);
	} catch (e) {
		const data = { error: e, maxSubscriptionId, currentSubscriptionId };
		log.error(data, `Error restoring subscriptions client key`);
		res.status(500).end(safeJsonStringify(data));
	}

};

const tryAndRestoreSubscriptionClientKey = async (subscription: Subscription) => {

	if (!subscription.jiraHost) {
		log.warn({ subscriptionId: subscription.id }, `Subscription jiraHost is empty, skip`);
		return false;
	}

	const installationsWithSameJiraHost: Installation[] = await Installation.findAll({
		where: { "jiraHost": subscription.jiraHost },
		order: [["createdAt", "DESC"]]
	});
	if (!installationsWithSameJiraHost.length) {
		log.warn({ subscriptionId: subscription.id }, `Couldn't find any installation matching subscription's jiraHost`);
		return false;
	}

	log.info({ subscriptionId: subscription.id }, `${installationsWithSameJiraHost.length} installations matching subscription ${subscription.id}`);
	for (const installation of installationsWithSameJiraHost) {
		const hashedAgainClientKey = getHashedKey(installation.clientKey);
		if (hashedAgainClientKey === subscription.jiraClientKey) {
			await Subscription.update({ jiraClientKey: installation.clientKey }, { where: { id: subscription.id } });
			log.info({ origin: subscription.jiraClientKey, replaced: installation.clientKey, subscriptionId: subscription.id }, `SUCCESS Found a matching double hash client key, replaced it with single hashed key`);
			return true;
		}
	}

	log.warn({ subscriptionId: subscription.id }, `Couldn't find any matching installation to replace jiraClientKey, skip`);
	return false;

};

const getDoubleHashedSubscriptions = async (maxSubscriptionId: number) => {
	const sql = `select * from "Subscriptions" where not exists (select null from "Installations" where "Installations"."clientKey" = "Subscriptions"."jiraClientKey") and "Subscriptions"."id" <= ${maxSubscriptionId}`;
	const doubleHashedSubscriptions = await Subscription.sequelize?.query(sql, { type: QueryTypes.SELECT, mapToModel: true });
	return doubleHashedSubscriptions;
};
