import { RepoSyncState } from "models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import { Subscription, SyncStatus } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export async function findOrStartSync(
	subscription: Subscription,
	logger: LoggerWithTarget | Logger,
	syncType?: "full" | "partial"
): Promise<void> {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	// Set sync status to PENDING, reset number of synced repos, remove repository cursor and status
	const [count] = await Promise.all([
		RepoSyncState.countFromSubscription(subscription),
		subscription.update({
			syncStatus: SyncStatus.PENDING,
			numberOfSyncedRepos: 0,
			totalNumberOfRepos: null,
			repositoryCursor: null,
			repositoryStatus: null
		})
	]);

	logger.info({ subscription, syncType }, "Starting sync");

	if (await booleanFlag(BooleanFlags.REPO_DISCOVERY_BACKFILL, false, subscription.jiraHost)) {
		if (syncType === "full") {
			// Remove all state as we're starting anew
			await RepoSyncState.deleteFromSubscription(subscription);
		}
	} else {
		if (count === 0 || syncType === "full") {
			// Reset all state if we're doing a full sync
			await RepoSyncState.resetSyncFromSubscription(subscription);
			await sqsQueues.discovery.sendMessage({ installationId, jiraHost }, 0, logger);
			return;
		}
	}

	// Start sync
	await sqsQueues.backfill.sendMessage({ installationId, jiraHost }, 0, logger);
}
