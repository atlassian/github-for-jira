import { RepoSyncState } from "models/reposyncstate";
import { sqsQueues } from "../sqs/queues";
import { Subscription, SyncStatus } from "models/subscription";
import Logger from "bunyan";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { TaskType } from "~/src/sync/sync.types";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import { envVars } from "config/env";
import { GITHUB_CLOUD_HOSTNAME, GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { GitHubServerApp } from "models/github-server-app";

export async function findOrStartSync(
	subscription: Subscription,
	logger: Logger,
	syncType?: "full" | "partial",
	commitsFromDate?: Date,
	targetTasks?: TaskType[]
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

	const gitHubAppConfig = await getGitHubAppConfig(subscription, logger);

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

const getGitHubAppConfig = async (subscription: Subscription, logger: Logger): Promise<GitHubAppConfig> => {

	const gitHubAppId = subscription.gitHubAppId;

	//cloud
	if (!gitHubAppId) return cloudGitHubAppConfig();

	//ghes
	const gitHubServerApp = await GitHubServerApp.findByPk(gitHubAppId);
	if (!gitHubServerApp) {
		logger.error("Cannot find gitHubServerApp by pk", { gitHubAppId: gitHubAppId, subscriptionId: subscription.id });
		throw new Error("Error duing find and start sync. Reason: Cannot find ghes record from subscription.");
	}
	return ghesGitHubAppConfig(gitHubServerApp);

};

const cloudGitHubAppConfig = () => {
	return {
		gitHubAppId: undefined,
		appId: parseInt(envVars.APP_ID),
		clientId: envVars.GITHUB_CLIENT_ID,
		gitHubBaseUrl: GITHUB_CLOUD_HOSTNAME,
		gitHubApiUrl: GITHUB_CLOUD_API_BASEURL,
		uuid: undefined
	};
};

const ghesGitHubAppConfig = (app: GitHubServerApp): GitHubAppConfig => {
	return {
		gitHubAppId: app.id,
		appId: app.appId,
		uuid: app.uuid,
		clientId: app.gitHubClientId,
		gitHubBaseUrl: app.gitHubBaseUrl,
		gitHubApiUrl: app.gitHubBaseUrl
	};
};
