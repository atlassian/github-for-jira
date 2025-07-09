import { Request, Response } from "express";
import { groupBy } from "lodash";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, SyncStatus } from "~/src/models/subscription";
import {
	mapSyncStatus,
	getRetryableFailedSyncErrors
} from "~/src/util/github-installations-helper";
import { errorWrapper } from "../../helper";
import {
	BackFillType,
	SubscriptionBackfillState,
	BackfillStatusError
} from "../../../../spa/src/rest-interfaces";
import { BaseLocals } from "..";
import { InsufficientPermissionError, InvalidArgumentError } from "~/src/config/errors";

const GetSubscriptionsBackfillStatus = async (req: Request<unknown, unknown, unknown, { subscriptionIds?: string }, BaseLocals>, res: Response) => {
	const { jiraHost: localJiraHost } = res.locals;
	const { subscriptionIds } = req.query;

	const subIds = String(subscriptionIds)
		.split(",")
		.map(Number)
		.filter(Boolean);
	if (subIds.length === 0) {
		req.log.warn("Missing Subscription IDs");
		throw new InvalidArgumentError("Missing Subscription IDs");
	}

	const subscriptions = await Subscription.findAllForSubscriptionIds(
		subIds
	);

	const resultSubscriptionIds: Array<number> = subscriptions.map(
		(subscription) => subscription.id
	);

	if (subscriptions.length === 0) {
		req.log.error("Missing Subscription");
		throw new InvalidArgumentError("Missing Subscription");
	}

	const jiraHostsMatched = subscriptions.every(
		(subscription) => subscription.jiraHost === localJiraHost
	);

	if (!jiraHostsMatched) {
		req.log.error("mismatched Jira Host");
		throw new InsufficientPermissionError("mismatched Jira Host");
	}
	const subscriptionsById = groupBy(subscriptions, "id");
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { backfillStatus, errors } = await getBackfillStatus(
		subscriptionsById
	);
	const isBackfillComplete = getBackfillCompletionStatus(backfillStatus);
	res.status(200).send({
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		subscriptions: backfillStatus,
		isBackfillComplete,
		subscriptionIds: resultSubscriptionIds,
		errors
	});
};

const getBackfillCompletionStatus = (backfillStatus: BackFillType): boolean =>
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	Object.values(backfillStatus).every(
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		(backFill: SubscriptionBackfillState): boolean => backFill.isSyncComplete
	);

const getBackfillStatus = async (
	subscriptionsById
): Promise<{
	backfillStatus: BackFillType;
	errors?: BackfillStatusError[];
}> => {
	const backfillStatus: BackFillType = {};
	const errors: BackfillStatusError[] = [];
	for (const subscriptionId in subscriptionsById) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			const subscription: Subscription = subscriptionsById[subscriptionId][0];
			const isSyncComplete =
				subscription.syncStatus === SyncStatus.COMPLETE ||
				subscription.syncStatus === SyncStatus.FAILED;
			const failedSyncErrors = await getRetryableFailedSyncErrors(subscription);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			backfillStatus[subscriptionId] = {
				id: parseInt(subscriptionId),
				isSyncComplete,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				syncStatus: mapSyncStatus(subscription.syncStatus),
				totalRepos: subscription.totalNumberOfRepos,
				syncedRepos: await RepoSyncState.countFullySyncedReposForSubscription(
					subscription
				),
				failedSyncErrors,
				backfillSince: subscription.backfillSince?.toString(),
				syncWarning: subscription.syncWarning,
				gitHubAppId: subscription.gitHubAppId
			};
		} catch (error: unknown) {
			errors.push({ subscriptionId, error: JSON.stringify(error) });
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	return { backfillStatus, errors };
};

export const GetSubBackfillStatusHandler = errorWrapper(
	"GetSubBackfillStatusHandler",
	GetSubscriptionsBackfillStatus
);
