import { NextFunction, Request, Response } from "express";
import { groupBy, countBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { TaskStatus } from "~/src/models/subscription";

type SubscriptionBackfillState = {
	totalRepos?: number;
	isSyncComplete?: boolean;
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
			req.log.error("Missing Subscription IDs");
			res.status(401).send("Missing Subscription IDs");
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
		) as unknown as {
			fulfilled: PromiseFulfilledResult<RepoSyncState>[];
			rejected: PromiseRejectedResult[];
		};

		const backfillStatus = getBackfillStatus(connections);

		const isbackFillComplete = getBackfillCompletionStatus(backfillStatus);
		res.status(200).send({
			data: {
				subscriptions: backfillStatus,
				isbackFillComplete,
				subscriptionIds
			}
		});
	} catch (error) {
		return next(new Error(`Failed to render connected repos: ${error}`));
	}
};

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean => {
	let isbackFillComplete = true;
	Object.values(backfillStatus).forEach(
		(backFill: SubscriptionBackfillState): void => {
			if (!backFill.isSyncComplete) {
				isbackFillComplete = false;
			}
		}
	);
	return isbackFillComplete;
};

const getBackfillStatus = (connections): BackFillType => {
	const backfillStatus: BackFillType = {};
	for (const subscriptionId in connections) {
		backfillStatus[subscriptionId] = {};
		const subscriptionRepos = connections[subscriptionId];
		const totalRepos = countBy(subscriptionRepos, "subscriptionId")[
			subscriptionId
		];
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
