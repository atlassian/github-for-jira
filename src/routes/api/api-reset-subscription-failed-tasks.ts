import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { TaskType } from "../../sync/sync.types";

interface OutputLogRecord {
	repoSyncStateId: number,
	targetTask: "pull" | "branch" | "commit" | "build" | "deployment" | "dependabotAlert" | string
}

export const ApiResetSubscriptionFailedTasks = async (req: Request, res: Response): Promise<void> => {
	const subscriptionId = req.body.subscriptionId;
	const targetTasks = req.body.targetTasks as TaskType[] || ["pull", "branch", "commit", "build", "deployment", "dependabotAlert"];

	if (!subscriptionId) {
		res.status(400).send("please provide subscriptionId");
		return;
	}

	const subscription = await Subscription.findByPk(subscriptionId);

	if (!subscription) {
		res.status(400).send("subscription not found");
		return;
	}

	const logs: OutputLogRecord[] = [];

	let offset = 0;
	let hasNextPage = true;
	const PAGE_SIZE = 100;

	do {
		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, PAGE_SIZE, offset, [["repoFullName", "ASC"]]);
		offset += repoSyncStates.length;
		hasNextPage = repoSyncStates.length === PAGE_SIZE;

		await Promise.all(repoSyncStates.map(async (repoSyncState) => {
			let updated = false;
			targetTasks.forEach(targetTask => {
				if (repoSyncState[`${targetTask}Status`] === "failed") {
					repoSyncState[`${targetTask}Status`] = null;
					logs.push({ repoSyncStateId: repoSyncState.id, targetTask });
					updated = true;
				}
			});
			if (updated) {
				await repoSyncState.save();
			}
		}));
	} while (hasNextPage);

	res.json(logs);
};
