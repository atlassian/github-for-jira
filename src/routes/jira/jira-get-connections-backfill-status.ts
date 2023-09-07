import { NextFunction, Request, Response } from "express";
import { groupBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import {
	TaskStatus,
	Subscription,
	SyncStatus
} from "~/src/models/subscription";
import { mapSyncStatus, ConnectionSyncStatus } from "./jira-get";

type SubscriptionBackfillState = {
	totalRepos?: number;
	isSyncComplete: boolean;
	syncedRepos?: number;
	backfillSince?: string;
	syncStatus: ConnectionSyncStatus;
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
		const { jiraHost: localJiraHost } = res.locals;
		const subscriptionIds: number[] = String(req.query?.subscriptionIds)
			.split(",")
			.map((id) => Number(id))
			.filter(Boolean);

		if (subscriptionIds?.length <= 0) {
			req.log.warn("Missing Subscription IDs");
			res.status(400).send("Missing Subscription IDs");
			return;
		}
		const subscriptions: Subscription[] = await Subscription.findAll({
			where: {
				id: subscriptionIds
			}
		});

		if (subscriptions?.length <= 0) {
			req.log.error("Missing Subscription");
			res.status(400).send("Missing Subscription");
			return;
		}

		const jiraHosts: string[] = subscriptions.map(
			(subscription) => subscription?.jiraHost
		);

		const jiraHostsMatched = jiraHosts.every(
			(jiraHost) => jiraHost === localJiraHost
		);

		if (!jiraHostsMatched) {
			req.log.error("mismatched Jira Host");
			res.status(403).send("mismatched Jira Host");
			return;
		}

		const repoSyncStates = await RepoSyncState.findAll({
			where: {
				subscriptionId: subscriptionIds
			}
		});

		const repos = groupBy(repoSyncStates, "subscriptionId");
		const subscriptionsById = groupBy(subscriptions, "id");
		const backfillStatus = getBackfillStatus(repos, subscriptionsById);

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

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean => Object.values(backfillStatus).every(
	(backFill: SubscriptionBackfillState): boolean => backFill?.isSyncComplete
);

const getBackfillStatus = (connections, subscriptionsById): BackFillType => {
	const backfillStatus: BackFillType = {};
	for (const subscriptionId in connections) {
		backfillStatus[subscriptionId] = {
			isSyncComplete: true,
			syncStatus: SyncStatus.PENDING
		};
		const subscriptionRepos = connections[subscriptionId];
		const totalRepos = subscriptionRepos?.length;
		backfillStatus[subscriptionId]["totalRepos"] = totalRepos;
		let isSyncComplete = subscriptionsById[subscriptionId][0]?.syncStatus;
		isSyncComplete = isSyncComplete === SyncStatus.COMPLETE || isSyncComplete === SyncStatus.FAILED;
		const syncStatus = mapSyncStatus(
			subscriptionsById[subscriptionId][0]?.syncStatus
		);
		const repos = subscriptionRepos.map((repoSyncState) => {
			return {
				name: repoSyncState?.repoFullName,
				repoSyncStatus: getSyncStatus(repoSyncState),
				syncStatus: syncStatus
			};
		});
		const syncedRepos = repos.filter((repo) =>
			["complete", "failed"].includes(repo?.repoSyncStatus)
		).length;
		backfillStatus[subscriptionId]["syncedRepos"] = syncedRepos;
		backfillStatus[subscriptionId]["backfillSince"] =
			subscriptionsById[subscriptionId][0]?.backfillSince || null;
		backfillStatus[subscriptionId]["isSyncComplete"] = isSyncComplete;
		backfillStatus[subscriptionId]["syncStatus"] = syncStatus;
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
