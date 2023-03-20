import Logger from "bunyan";
import { envVars } from "config/env";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { GitHubServerApp } from "models/github-server-app";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription, SyncStatus } from "models/subscription";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";
import { SyncType, TaskType } from "~/src/sync/sync.types";
import { sqsQueues } from "../sqs/queues";

export const findOrStartSync = async (
	subscription: Subscription,
	logger: Logger,
	syncType?: SyncType,
	commitsFromDate?: Date,
	targetTasks?: TaskType[]
): Promise<void> => {
	let fullSyncStartTime;
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	await subscription.update({
		syncStatus: SyncStatus.PENDING,
		numberOfSyncedRepos: 0,
		syncWarning: null
	});

	logger.info({ subscriptionId: subscription.id, syncType }, "Starting sync");

	await resetTargetedTasks(subscription, syncType, targetTasks);

	if (syncType === "full" && !targetTasks?.length) {
		fullSyncStartTime = new Date().toISOString();
		await subscription.update({
			totalNumberOfRepos: null,
			repositoryCursor: null,
			repositoryStatus: null
		});
		// Remove all state as we're starting anew
		await RepoSyncState.deleteFromSubscription(subscription);
	}

	const gitHubAppConfig = await getGitHubAppConfig(subscription, logger);

	const mainCommitsFromDate = await getCommitSinceDate(jiraHost, NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, commitsFromDate?.toISOString());
	const branchCommitsFromDate = await getCommitSinceDate(jiraHost, NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, commitsFromDate?.toISOString());

	// Start sync
	await sqsQueues.backfill.sendMessage({
		installationId,
		jiraHost,
		syncType,
		startTime: fullSyncStartTime,
		commitsFromDate: mainCommitsFromDate?.toISOString(),
		branchCommitsFromDate: branchCommitsFromDate?.toISOString(),
		targetTasks,
		gitHubAppConfig
	}, 0, logger);
};

type SubscriptionUpdateTasks = {
	totalNumberOfRepos?: number | null;
	repositoryCursor?: string | null;
	repositoryStatus?: string | null;
}

const resetTargetedTasks = async (subscription: Subscription, syncType?: SyncType, targetTasks?: TaskType[]): Promise<void> => {
	if (!targetTasks?.length) {
		return;
	}

	// Reset RepoSync states - target tasks: ("pull" | "commit" | "branch" | "build" | "deployment")
	// Full sync resets cursor and status
	// Partial sync only resets status (continues from existing cursor)
	const repoSyncTasks = targetTasks.filter(task => task !== "repository");
	const updateRepoSyncTasks = { repoUpdatedAt: null };

	repoSyncTasks.forEach(task => {
		if (syncType === "full") {
			updateRepoSyncTasks[`${task}Cursor`] = null;
		}
		updateRepoSyncTasks[`${task}Status`] = null;
	});

	await RepoSyncState.update(updateRepoSyncTasks, {
		where: {
			subscriptionId: subscription.id
		}
	});

	// Reset Subscription Repo state -  target tasks: ("repository")
	// Full sync resets cursor and status and totalNumberOfRepos
	// Partial sync only resets status (continues from existing cursor)
	if (targetTasks.includes("repository")) {
		const updateSubscriptionTasks: SubscriptionUpdateTasks = {
			repositoryStatus: null
		};

		if (syncType === "full") {
			updateSubscriptionTasks.totalNumberOfRepos = null;
			updateSubscriptionTasks.repositoryCursor = null;
		}
		await subscription.update(updateSubscriptionTasks);
	}

};

export const getCommitSinceDate = async (jiraHost: string, flagName: NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT | NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, commitsFromDate?: string): Promise<Date | undefined> => {
	if (commitsFromDate) {
		return new Date(commitsFromDate);
	}
	const timeCutoffMsecs = await numberFlag(flagName, NaN, jiraHost);
	if (!timeCutoffMsecs || timeCutoffMsecs === -1) {
		return undefined;
	}
	return new Date(Date.now() - timeCutoffMsecs);
};

const getGitHubAppConfig = async (subscription: Subscription, logger: Logger): Promise<GitHubAppConfig> => {

	const gitHubAppId = subscription.gitHubAppId;

	// cloud
	if (!gitHubAppId) return cloudGitHubAppConfig();

	// ghes
	const gitHubServerApp = await GitHubServerApp.findByPk(gitHubAppId);
	if (!gitHubServerApp) {
		logger.error("Cannot find gitHubServerApp by pk", { gitHubAppId: gitHubAppId, subscriptionId: subscription.id });
		throw new Error("Error during find and start sync. Reason: Cannot find ghes record from subscription.");
	}
	return ghesGitHubAppConfig(gitHubServerApp);

};

const cloudGitHubAppConfig = () => {
	return {
		gitHubAppId: undefined,
		appId: parseInt(envVars.APP_ID),
		clientId: envVars.GITHUB_CLIENT_ID,
		gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
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
