import { NextFunction, Request, Response } from "express";
import { groupBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { TaskStatus } from "~/src/models/subscription";

type SubscriptionBackfillState = {
	totalRepos?: number;
	isSyncComplete: boolean;
	syncedRepos?: number;
	backfillSince?: string | null;
};
type BackFillType = {
	[key: string]: SubscriptionBackfillState;
};

export const JiraGetConnectionsBackfillStatus = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const subscriptionIds: number[] = String(req.query.subscriptionIds)
			.split(",")
			.map((id) => Number(id))
			.filter(Boolean);

		if (subscriptionIds.length <= 0) {
			req.log.warn("Missing Subscription IDs");
			res.status(400).send("Missing Subscription IDs");
			return;
		}

		const repoSyncStates = await RepoSyncState.findAll({
			where: {
				subscriptionId: subscriptionIds
			}
		});

		const connections = groupBy(
			repoSyncStates,
			"subscriptionId"
		);

		const backfillStatus = getBackfillStatus(connections);

		const isBackfillComplete = getBackfillCompletionStatus(backfillStatus);
		res.status(200).send({
			data: {
				subscriptions: backfillStatus,
				isBackfillComplete,
				subscriptionIds
			}
		});
	} catch (error) {
		return next(new Error(`Failed to render connected repos: ${error}`));
	}
};

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean => {
	let isBackfillComplete = true;
	isBackfillComplete = Object.values(backfillStatus).every(
		(backFill: SubscriptionBackfillState): boolean =>
			backFill.isSyncComplete
	);
	return isBackfillComplete;
};

const getBackfillStatus = (connections): BackFillType => {
	const backfillStatus: BackFillType = {};
	for (const subscriptionId in connections) {
		backfillStatus[subscriptionId] = { isSyncComplete: true };
		const subscriptionRepos = connections[subscriptionId];
		const totalRepos = subscriptionRepos.length;
		backfillStatus[subscriptionId]["totalRepos"] = totalRepos;
		const repos = subscriptionRepos.map((repoSyncState) => {
			return {
				name: repoSyncState.repoFullName,
				syncStatus: getSyncStatus(repoSyncState)
			};
		});
		const syncedRepos = repos.filter((repo) =>
			["complete", "failed"].includes(repo.syncStatus)
		).length;
		backfillStatus[subscriptionId]["syncedRepos"] = syncedRepos;
		backfillStatus[subscriptionId]["isSyncComplete"] =
			syncedRepos === totalRepos;
	}
	return backfillStatus;
};

const getSyncStatus = (repoSyncState: RepoSyncState): TaskStatus => {
	const statuses = [
		repoSyncState?.branchStatus,
		repoSyncState?.commitStatus,
		repoSyncState?.pullStatus,
		repoSyncState?.buildStatus,
		repoSyncState?.deploymentStatus
	];
	if (statuses.includes("pending")) {
		return "pending";
	}
	if (statuses.includes("failed")) {
		return "failed";
	}
	const hasCompleteStatus = statuses.every((status) => status == "complete");
	if (hasCompleteStatus) {
		return "complete";
	}
	return "pending";
};
