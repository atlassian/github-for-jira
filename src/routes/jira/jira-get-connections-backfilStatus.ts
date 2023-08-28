import { NextFunction, Request, Response } from "express";
import { groupBy, countBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
// import { Subscription, TaskStatus } from "~/src/models/subscription";
import { TaskStatus } from "~/src/models/subscription";


type subscriptionBackfillState = {
	totalRepos?: Number;
	syncCompleted?: Boolean;
	syncedRepos?: Number;
	backfillSince?: string | null;
}
type backFillType = {
	[key: string] : subscriptionBackfillState | {}
};

export const JiraGetConnectionsBackfilStatus = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const subscriptionIds: number[] = String(req.query.subscriptionIds)
			.split(",")
			.map((id) => Number(id))
			.filter((n) => !!n);

		if (subscriptionIds.length <= 0) {
			req.log.error("Missing Subscription IDs");
			res.status(401).send("Missing Subscription IDs");
			return;
		}

		// const subscriptionStatus = await Subscription.findAll({
		// 	where: {
		// 		id: subscriptionIds,
		// 	}
		// });
		// const subscriptions = groupBy(subscriptionStatus, "id") as unknown as { fulfilled: PromiseFulfilledResult<Subscription>[], rejected: PromiseRejectedResult[] };


		// if (!subscriptions) {
		// 	req.log.error("Missing Subscription");
		// 	res.status(401).send("Missing Subscription");
		// 	return;
		// }

		const repoSyncStates = await RepoSyncState.findAll({
			where: {
				subscriptionId: subscriptionIds,
			}
		});

		const connections = groupBy(repoSyncStates, "subscriptionId") as unknown as { fulfilled: PromiseFulfilledResult<RepoSyncState>[], rejected: PromiseRejectedResult[] };
		let backfillStatus : backFillType = {};

		for (const subscriptionId in connections)	 {
			backfillStatus[subscriptionId] = {};
			const subscriptionRepos = connections[subscriptionId];
			// const subscription = subscriptions[subscriptionId][0];
			// const totalRepos = subscription['totalNumberOfRepos'];
			// const backfillSince = subscription['backfillSince'];
			let totalRepos = (countBy(subscriptionRepos,'subscriptionId'))[subscriptionId];
			backfillStatus[subscriptionId]['totalRepos'] = totalRepos;
			// backfillStatus[subscriptionId]['backfillSince'] = backfillSince;
			const repos = subscriptionRepos.map((repoSyncState) => {
				return {
					name: repoSyncState.repoFullName,
					syncStatus: getSyncStatus(repoSyncState),
				};
			});
			const syncedRepos = repos.filter((repo) =>
				["complete", "failed"].includes(repo.syncStatus)
			).length;
			backfillStatus[subscriptionId]['syncedRepos'] = syncedRepos;
			backfillStatus[subscriptionId]['syncCompleted'] = syncedRepos === totalRepos;
		}

		let backFillCompleted = true;
		Object.values(backfillStatus).forEach((backFill: subscriptionBackfillState) : void=> {
			if(!backFill.syncCompleted){
				backFillCompleted = false;
			}
		});
		res.status(200).send({
			data:{
				subscriptions: backfillStatus,
				backFillCompleted,
				subscriptionIds,
			}
		});
	} catch (error) {
		return next(new Error(`Failed to render connected repos: ${error}`));
	}
};

const getSyncStatus = (repoSyncState: RepoSyncState): TaskStatus => {
	const statuses = [
		repoSyncState?.branchStatus,
		repoSyncState?.commitStatus,
		repoSyncState?.pullStatus,
		repoSyncState?.buildStatus,
		repoSyncState?.deploymentStatus,
	];
	if (statuses.includes("pending")) {
		return "pending";
	}
	if (statuses.includes("failed")) {
		return "failed";
	}
	const completeStatusesCount = statuses.filter(
		(status) => status == "complete"
	).length;
	if (completeStatusesCount === statuses.length) {
		return "complete";
	}
	return "pending";
};
