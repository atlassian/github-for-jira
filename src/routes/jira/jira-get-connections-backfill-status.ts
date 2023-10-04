import { NextFunction, Request, Response } from "express";
import { groupBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import {
	Subscription,
	SyncStatus
} from "~/src/models/subscription";
import { mapSyncStatus, ConnectionSyncStatus, getRetryableFailedSyncErrors } from "~/src/util/github-installations-helper";

type SubscriptionBackfillState = {
	totalRepos?: number;
	isSyncComplete: boolean;
	syncedRepos?: number;
	backfillSince?: string;
	syncWarning?: string;
	failedSyncErrors?: Record<string, number>;
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
		let subscriptions: Subscription[] = await Subscription.findAll({
			where: {
				id: subscriptionIds
			}
		});
		subscriptions = subscriptions.filter((subscription: Subscription) => subscription.totalNumberOfRepos && subscription.totalNumberOfRepos > 0);
		const resultSubscriptionIds = subscriptions.map(subscription => subscription.id);

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
		const subscriptionsById = groupBy(subscriptions, "id");
		const backfillStatus = await getBackfillStatus(subscriptionsById);
		const isBackfillComplete = getBackfillCompletionStatus(backfillStatus);
		res.status(200).send({
			data: {
				subscriptions: backfillStatus,
				isBackfillComplete,
				subscriptionIds: resultSubscriptionIds
			}
		});
	} catch (error) {
		return next(new Error(`Failed to render connected repos`));
	}
};

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean => Object.values(backfillStatus).every(
	(backFill: SubscriptionBackfillState): boolean => backFill?.isSyncComplete
);

const getBackfillStatus = async (subscriptionsById): Promise<BackFillType>=> {
	const backfillStatus: BackFillType = {};
	for (const subscriptionId in subscriptionsById) {
		backfillStatus[subscriptionId] = {
			isSyncComplete: true,
			syncStatus: SyncStatus.PENDING
		};
		const subscription = subscriptionsById[subscriptionId][0];
		const totalRepos = subscription?.totalNumberOfRepos;
		backfillStatus[subscriptionId]["totalRepos"] = totalRepos;
		let isSyncComplete = subscription?.syncStatus;
		isSyncComplete = isSyncComplete === SyncStatus.COMPLETE || isSyncComplete === SyncStatus.FAILED;
		const syncStatus = mapSyncStatus(
			subscription?.syncStatus
		);
		backfillStatus[subscriptionId]["syncedRepos"] = await RepoSyncState.countFullySyncedReposForSubscription(subscription);
		const failedSyncErrors=  await getRetryableFailedSyncErrors(subscription);
		backfillStatus[subscriptionId]["failedSyncErrors"] = failedSyncErrors;
		backfillStatus[subscriptionId]["backfillSince"] =
			subscription?.backfillSince || null;
		backfillStatus[subscriptionId]["isSyncComplete"] = isSyncComplete;
		backfillStatus[subscriptionId]["syncStatus"] = syncStatus;
		backfillStatus[subscriptionId]["syncWarning"] = subscription.syncWarning;
	}
	return backfillStatus;
};
