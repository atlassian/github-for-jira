import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { getLogger } from "~/src/config/logger";
import { TaskType } from "~/src/sync/sync.types";


export const ApiResyncFailedTasksPost = async (req: Request, res: Response): Promise<void> => {

	const logger = getLogger("ApiResyncFailedTasksPost");

	const info = (msg: string) => {
		logger.info(msg);
		res.write(msg + "\n");
	};
	res.status(200);

	const subscriptionsIds = req.body.subscriptionsIds as number[];

	const targetTasks = req.body.targetTasks as TaskType[];

	if (!subscriptionsIds.length) {
		res.status(400).send("Please provide at least one subscription id!");
		return;
	}

	if (!targetTasks) {
		res.status(400).send("Please provide target type");
		return;
	}

	info(`Starting backfill for ${subscriptionsIds.length} for tasks ${JSON.stringify(subscriptionsIds)} `);
	let successfulCount = 0;
	subscriptionsIds.forEach(async(subscriptionId) => {
		const subscription = await Subscription.findByPk(subscriptionId);
		if (subscription) {
			await findOrStartSync(subscription, logger, "full", subscription.backfillSince, targetTasks, { source: "api-resync-failed-tasks" });
			successfulCount++;
		} else {
			info(`Subscription not found for ${subscriptionId}`);
		}
	});
	info(`Triggered backfill successfully for ${successfulCount}/${subscriptionsIds.length}`);

};
