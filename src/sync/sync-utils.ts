import RepoSyncState from "../models/reposyncstate";
import {queues} from "../worker/queues";
import sqsQueues from "../sqs/queues";
import Subscription from "../models/subscription";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import Logger from 'bunyan';

export async function findOrStartSync(
	subscription: Subscription,
	logger: LoggerWithTarget | Logger,
	syncType?: string
): Promise<void> {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	const count = await RepoSyncState.countFromSubscription(subscription)
	if (count === 0 || syncType === "full") {
		await RepoSyncState.resetSyncFromSubscription(subscription);
		logger.info("Starting Jira sync");
		if(await booleanFlag(BooleanFlags.USE_SQS_FOR_DISCOVERY_QUEUE, false, subscription.jiraHost)) {
			await sqsQueues.discovery.sendMessage({installationId, jiraHost}, 0, logger)
		} else {
			await queues.discovery.add({installationId, jiraHost});
		}
		return;
	}


	// Otherwise, just add a job to the queue for this installation
	// This will automatically pick back up from where it left off
	// if something got stuck
	await sqsQueues.backfill.sendMessage({installationId, jiraHost}, 0, logger);
}
