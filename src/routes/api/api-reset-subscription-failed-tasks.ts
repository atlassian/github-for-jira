import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";

export const ApiResetSubscriptionFailedTasks = async (req: Request, res: Response): Promise<void> => {
	const subscriptionId = req.body.subscriptionId;
	const targetTasks = req.body.targetTasks as string[] || ["pull", "branch", "commit", "build", "deployment"];

	if (!subscriptionId) {
		res.status(400).send("please provide subscriptionId");
		return;
	}

	const subscription = await Subscription.findByPk(subscriptionId);

	if (!subscription) {
		res.status(400).send("subscription not found");
		return;
	}

	const log: any[] = [];

	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription);
	await Promise.all(repoSyncStates.map(async (repoSyncState) => {
		let updated = false;
		targetTasks.forEach(targetTask => {
			if (repoSyncState[`${targetTask}Status`] === "failed") {
				repoSyncState[`${targetTask}Status`] = null;
				log.push({ repoSyncStateId: repoSyncState.id, targetTask });
				updated = true;
			}
		});
		if (updated) {
			await repoSyncState.save();
		}
	}));

	res.json(log);
};
