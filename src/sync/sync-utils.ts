import { RepoSyncState } from "models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import { Subscription, SyncStatus } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import Logger from "bunyan";

export async function findOrStartSync(
	subscription: Subscription,
	logger: LoggerWithTarget | Logger,
	syncType?: "full" | "partial"
): Promise<void> {
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
	}

	// Start sync
	await sqsQueues.backfill.sendMessage({ installationId, jiraHost }, 0, logger);
}
