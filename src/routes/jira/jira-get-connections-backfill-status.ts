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

type ErrorType = {
	subscriptionId: string;
	error: string;
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

		const subscriptions = await Subscription.findAllForSubscriptionIds(
			subscriptionIds
		);

		const resultSubscriptionIds = subscriptions.map(
			(subscription) => subscription.id
		);

		if (!subscriptions || subscriptions.length === 0) {
			req.log.error("Missing Subscription");
			res.status(400).send("Missing Subscription");
			return;
		}

		const jiraHostsMatched = subscriptions.every(
			(subscription) => subscription?.jiraHost === localJiraHost
		);

		if (!jiraHostsMatched) {
			req.log.error("mismatched Jira Host");
			res.status(403).send("mismatched Jira Host");
			return;
		}
		const subscriptionsById = groupBy(subscriptions, "id");
		const { backfillStatus, errors } = await getBackfillStatus(
			subscriptionsById
		);
		const isBackfillComplete = getBackfillCompletionStatus(backfillStatus);
		res.status(200).send({
			data: {
				subscriptions: backfillStatus,
				isBackfillComplete,
				subscriptionIds: resultSubscriptionIds,
				errors
			}
		});
	} catch (error) {
		req.log.error(
			{ error },
			"Failed to poll repo backfill status for provided subscription ID"
		);
		return next(
			new Error(
				`Failed to poll repo backfill status for provided subscription ID`
			)
		);
	}
};

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean =>
	Object.values(backfillStatus).every(
		(backFill: SubscriptionBackfillState): boolean => backFill?.isSyncComplete
	);

const getBackfillStatus = async (
	subscriptionsById
): Promise<{ backfillStatus: BackFillType; errors?: ErrorType[] }> => {
	const backfillStatus: BackFillType = {};
	const errors: ErrorType[] = [];
	for (const subscriptionId in subscriptionsById) {
		try {
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
		} catch (error) {
			errors.push({ subscriptionId, error });
		}
	}
	return { backfillStatus, errors };
};
