import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { QueryTypes } from "sequelize";
import { Subscription } from "models/subscription";
import { Installation } from "models/installation";
import safeJsonStringify from "safe-json-stringify";
import { getHashedKey } from "models/sequelize";

const log = getLogger("SubscriptionJiraClientKeyRestorePost");

const getSqlForDoubleHashedClientKeySubs = (maxSubscriptionId: number) => {
	return `select * from "Subscriptions" where not exists (select null from "Installations" where "Installations"."clientKey" = "Subscriptions"."jiraClientKey") and "Subscriptions"."id" <= ${maxSubscriptionId}`;
};

export const SubscriptionJiraClientKeyRestorePost = async (req: Request, res: Response): Promise<void> => {

	const maxSubscriptionId = Number(req.query.maxSubscriptionId) || -1;
	log.info({ maxSubscriptionId }, `About to restore subscriptions jira client key (from double hashed)`);

	let currentSubscriptionId: number | undefined;
	try {

		const getDoubleHashedSubsSql = getSqlForDoubleHashedClientKeySubs(maxSubscriptionId);
		const doubleHashedSubscriptions = await Subscription.sequelize?.query(getDoubleHashedSubsSql, { type: QueryTypes.SELECT, mapToModel: true });

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
		log.warn(`Subscription ${subscription.id} jiraHost is empty, skip`);
		return false;
	}

	const installationsWithSameJiraHost: Installation[] = await Installation.findAll({
		where: { "jiraHost": subscription.jiraHost },
		order: [ "createdAt", "DESC" ]
	});
	if (!installationsWithSameJiraHost.length) {
		log.warn(`Couldn't find any installation matching subscription ${subscription.id}'s jiraHost`);
		return false;
	}

	log.info(`${installationsWithSameJiraHost.length} installations matching subscription ${subscription.id}`);
	for (const installation of installationsWithSameJiraHost) {
		const hashedAgainClientKey = getHashedKey(installation.clientKey);
		if (hashedAgainClientKey === subscription.jiraClientKey) {
			log.info({ origin: subscription.jiraClientKey, replaced: installation.clientKey }, `Found a matching double hash client key for subscription ${subscription.id}, replacing it with single hashed key`);
			subscription.jiraClientKey = installation.clientKey;
			await subscription.save();
			log.info({ origin: subscription.jiraClientKey, replaced: installation.clientKey }, `subscription ${subscription.id} replaced with single hashed key`);
			return true;
		}
	}

	log.warn(`Couldn't find any matching installation to replace jiraClientKey for subscription ${subscription.id}, skip`);
	return false;

};
