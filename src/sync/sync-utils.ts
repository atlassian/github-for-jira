import {booleanFlag, BooleanFlags} from "../config/feature-flags";
import RepoSyncState from "../models/reposyncstate";
import logger from "../config/logger";
import {queues} from "../worker/queues";
import sqsQueues from "../sqs/queues";
import Subscription from "../models/subscription";


export async function findOrStartSync(
	subscription: Subscription,
	syncType?: string
): Promise<void> {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;

	if (!subscription.repoSyncState || syncType === "full") {
		subscription.changed("repoSyncState", true);
		await subscription.update({
			syncStatus: "PENDING",
			syncWarning: "",
			repoSyncState: {
				installationId,
				jiraHost,
				repos: {}
			}
		});
		if (await booleanFlag(BooleanFlags.NEW_REPO_SYNC_STATE, false, subscription.jiraHost)) {
			await RepoSyncState.resetSyncFromSubscription(subscription);
		}
		logger.info("Starting Jira sync");
		await queues.discovery.add({ installationId, jiraHost });
		return;
	}


	// Otherwise, just add a job to the queue for this installation
	// This will automatically pick back up from where it left off
	// if something got stuck
	await sqsQueues.backfill.sendMessage({installationId, jiraHost}, 0, logger);
}
