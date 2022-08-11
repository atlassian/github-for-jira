import { RepoSyncState } from "models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import { Subscription, SyncStatus } from "models/subscription";
import Logger from "bunyan";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { TaskType } from "~/src/sync/sync.types";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";

export async function findOrStartSync(
	subscription: Subscription,
	logger: Logger,
	syncType?: "full" | "partial",
	commitsFromDate?: Date,
	targetTasks?: TaskType[],
	gitHubAppConfig? :GitHubAppConfig
): Promise<void> {
	let fullSyncStartTime;
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	// Set sync status to PENDING, reset number of synced repos, remove repository cursor and status
	await subscription.update({
		syncStatus: SyncStatus.PENDING,
		numberOfSyncedRepos: 0,
		totalNumberOfRepos: null,
		repositoryCursor: null,
		repositoryStatus: null,
		syncWarning: null
	});

	logger.info({ subscription, syncType }, "Starting sync");

	if (syncType === "full") {
		// Remove all state as we're starting anew
		await RepoSyncState.deleteFromSubscription(subscription);
		fullSyncStartTime = new Date().toISOString();
	}

	// Start sync
	await sqsQueues.backfill.sendMessage({
		installationId,
		jiraHost,
		startTime: fullSyncStartTime,
		commitsFromDate: commitsFromDate?.toISOString(),
		targetTasks,
		gitHubAppConfig
	}, 0, logger);
}

export const getCommitSinceDate = async (jiraHost: string, flagName: NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT | NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, commitsFromDate?: string): Promise<Date | undefined> => {
	if (commitsFromDate) {
		return new Date(commitsFromDate);
	}
	const timeCutoffMsecs = await numberFlag(flagName, NaN, jiraHost);
	if (!timeCutoffMsecs) {
		return;
	}
	return new Date(Date.now() - timeCutoffMsecs);
};
