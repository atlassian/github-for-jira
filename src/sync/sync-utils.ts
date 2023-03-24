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
import { backfillFromDateToBucket } from "config/metric-helpers";

export const findOrStartSync = async (
	subscription: Subscription,
	logger: Logger,
	syncType: SyncType,
	commitsFromDate?: Date,
	targetTasks?: TaskType[],
	metricTags?: Record<string, string>
): Promise<void> => {
	const { gitHubInstallationId: installationId, jiraHost } = subscription;
	await subscription.update({
		syncStatus: SyncStatus.PENDING,
		numberOfSyncedRepos: 0,
		syncWarning: null
	});

	logger.info({ subscriptionId: subscription.id, syncType }, "Starting sync");

	await resetRepoTaskStatusAndCursor(subscription, syncType, targetTasks);

	const gitHubAppConfig = await getGitHubAppConfig(subscription, logger);

	const { mainCommitsFromDate, branchCommitsFromDate } = await getCommitsFromDates(jiraHost, commitsFromDate);

	// Start sync
	await sqsQueues.backfill.sendMessage({
		installationId,
		jiraHost,
		syncType,
		startTime: new Date().toISOString(),
		commitsFromDate: mainCommitsFromDate?.toISOString(),
		branchCommitsFromDate: branchCommitsFromDate?.toISOString(),
		targetTasks,
		gitHubAppConfig,
		metricTags: {
			...metricTags,
			backfillFrom: backfillFromDateToBucket(mainCommitsFromDate),
			syncType: syncType ? String(syncType) : "empty"
		}
	}, 0, logger);
};

const getCommitsFromDates = async (jiraHost: string, commitsFromDate: Date | undefined) => {
	const mainCommitsFromDate = await getCommitSinceDate(jiraHost, NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, commitsFromDate?.toISOString());
	const branchCommitsFromDate = await getCommitSinceDate(jiraHost, NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, commitsFromDate?.toISOString());
	return { mainCommitsFromDate, branchCommitsFromDate };
};

const resetRepoTaskStatusAndCursor = async (subscription: Subscription, syncType: SyncType, targetTasks?: TaskType[]) => {

	const hasTargetTasks = !!targetTasks?.length;
	const hasRepositoryTask = (targetTasks || []).includes("repository");

	if (syncType == "full") {
		if (hasTargetTasks) {
			//should do a full sync only for the specified tasks
			await resetTargetedTasks(subscription, syncType, targetTasks);
			if (hasRepositoryTask) {
				await subscription.update({ totalNumberOfRepos: null, repositoryStatus: null, repositoryCursor: null });
			}
			await RepoSyncState.update({ failedCode: null }, { where: { subscriptionId: subscription.id } });
		} else {
			// Didn't provide any target tasks for a full sync, so remove all state as we're starting anew
			await subscription.update({ totalNumberOfRepos: null, repositoryCursor: null, repositoryStatus: null });
			await RepoSyncState.deleteFromSubscription(subscription);
		}
	} else {
		//For partial sync
		if (hasTargetTasks) {
			await resetTargetedTasks(subscription, syncType, targetTasks);
			if (hasRepositoryTask) {
				await subscription.update({ repositoryStatus: null });
			}
		} else {
			//do nothing on resetting status/cursor/fail
		}
	}
};


const resetTargetedTasks = async (subscription: Subscription, syncType: SyncType, targetTasks: TaskType[]): Promise<void> => {

	const repoSyncTasks = (targetTasks || []).filter(t => t !== "repository");

	if (repoSyncTasks.length === 0) {
		return;
	}

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
