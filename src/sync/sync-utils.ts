import RepoSyncState from "models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import Subscription, { SyncStatus } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import Logger from "bunyan";

export async function findOrStartSync(
	subscription: Subscription,
	logger: LoggerWithTarget | Logger,
	syncType?: "full" | "partial"
): Promise<void> {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	const [count] = await Promise.all([
		RepoSyncState.countFromSubscription(subscription),
		// Set sync status to PENDING
		subscription.update({ syncStatus: SyncStatus.PENDING })
	]);

	logger.info({ subscription, syncType, count }, "Starting sync");

	if (count === 0 || syncType === "full") {
		// Reset all state if we're doing a full sync
		await RepoSyncState.resetSyncFromSubscription(subscription);
		await sqsQueues.discovery.sendMessage({ installationId, jiraHost }, 0, logger);
		return;
	}

	// This will automatically pick back up from where it left off
	await sqsQueues.backfill.sendMessage({ installationId, jiraHost }, 0, logger);
}
