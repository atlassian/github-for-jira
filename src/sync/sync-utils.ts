import RepoSyncState from "../models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import Subscription from "../models/subscription";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import Logger from "bunyan";

export async function findOrStartSync(
	subscription: Subscription,
	logger: LoggerWithTarget | Logger,
	syncType: "full" | "partial"
): Promise<void> {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	const count = await RepoSyncState.countFromSubscription(subscription)
	if (count === 0 || syncType === "full") {
		await RepoSyncState.resetSyncFromSubscription(subscription);
		logger.info("Starting Jira sync");
		await sqsQueues.discovery.sendMessage({installationId, jiraHost}, 0, logger)
		return;
	}

	// Otherwise, just add a job to the queue for this installation
	// This will automatically pick back up from where it left off
	// if something got stuck
	await sqsQueues.backfill.sendMessage({installationId, jiraHost}, 0, logger);
}
