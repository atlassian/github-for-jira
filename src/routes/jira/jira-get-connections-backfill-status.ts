import { NextFunction, Request, Response } from "express";
import { groupBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, SyncStatus } from "~/src/models/subscription";
import {
	mapSyncStatus,
	ConnectionSyncStatus,
	getRetryableFailedSyncErrors
} from "~/src/util/github-installations-helper";

type SubscriptionBackfillState = {
	totalRepos?: number;
	syncedRepos?: number;
	syncStatus: ConnectionSyncStatus;
	isSyncComplete: boolean;
	backfillSince?: string;
	failedSyncErrors?: Record<string, number>;
	syncWarning?: string;
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
		const subscriptionIds = String(req.query?.subscriptionIds)
			.split(",")
			.map(Number)
			.filter(Boolean);

		if (subscriptionIds.length === 0) {
			req.log.warn("Missing Subscription IDs");
			res.status(400).send("Missing Subscription IDs");
			return;
		}

		const subscriptions = await Subscription.findAll({
			where: {
				id: subscriptionIds
			}
		});
		const resultSubscriptionIds = subscriptions.map(
			(subscription) => subscription.id
		);

		if (!subscriptions || subscriptions.length === 0) {
			req.log.error("Missing Subscription");
			res.status(400).send("Missing Subscription");
			return;
		}

		const jiraHosts = subscriptions.map(
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

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean =>
	Object.values(backfillStatus).every(
		(backFill: SubscriptionBackfillState): boolean => backFill?.isSyncComplete
	);

const getBackfillStatus = async (subscriptionsById): Promise<BackFillType> => {
	const backfillStatus: BackFillType = {};
	for (const subscriptionId in subscriptionsById) {
		const subscription = subscriptionsById[subscriptionId][0];
		const isSyncComplete =
			subscription?.syncStatus === SyncStatus.COMPLETE ||
			subscription?.syncStatus === SyncStatus.FAILED;
		const failedSyncErrors = await getRetryableFailedSyncErrors(subscription);

		backfillStatus[subscriptionId] = {
			isSyncComplete,
			syncStatus: mapSyncStatus(subscription?.syncStatus),
			totalRepos: subscription?.totalNumberOfRepos,
			syncedRepos: await RepoSyncState.countFullySyncedReposForSubscription(
				subscription
			),
			failedSyncErrors,
			backfillSince: subscription?.backfillSince || null,
			syncWarning: subscription.syncWarning
		};
	}
	return backfillStatus;
};
