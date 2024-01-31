import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { Op } from "sequelize";
import { getLogger } from "config/logger";
import safeJsonStringify from "safe-json-stringify";

const DEFAULT_BATCH_SIZE = 5000;

export const RecoverCommitsFromDatePost = async (req: Request, res: Response): Promise<void> => {

	const log = getLogger("RecoverCommitsFromDatePost");

	try {

		const startSubscriptionId = Number(req.query.startSubscriptionId) || 0;
		const batchSize = Number(req.query.batchSize) || DEFAULT_BATCH_SIZE;

		const info = (msg: string) => {
			log.info(msg);
			res.write(msg + "\n");
		};

		res.status(200);

		info(`Start recovering commits from date for Subscription starting from ${startSubscriptionId} with batch size ${batchSize}`);

		const subscriptionToBeUpdated: Subscription[] = await Subscription.findAll({
			limit: batchSize,
			where: {
				[Op.and]: {
					"backfillSince": {
						[Op.lt]: new Date(1980, 1, 1)
					},
					"id": {
						[Op.gt]: startSubscriptionId
					}
				}
			},
			order: [ ["id", "ASC"] ]
		});
		info(`Found ${subscriptionToBeUpdated.length} subscriptions potentially to look at`);

		let count = 0;
		let lastId: number | undefined;
		for (const sub of subscriptionToBeUpdated) {
			if (sub.backfillSince?.getFullYear() === 1970) {
				//just double check it is the default year for backfill all time
				await sub.update({
					backfillSince: null
				});
				count++;
			}
			lastId = sub.id;
		}
		info(`${count} subscriptions updated, last subscription id is ${lastId})`);

		res.end();

	} catch (e: unknown) {
		log.error({ err: e }, "Error happen when recovering commits from date");
		res.end(`Error happen when recovering commits from date: ${safeJsonStringify(e as object)}`);
	}
};
