import { AppInstallation, FailedAppInstallation } from "config/interfaces";
import { Request } from "express";
import Logger from "bunyan";
import { Subscription, SyncStatus } from "models/subscription";
import { createAppClient } from "utils/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { RepoSyncState } from "models/reposyncstate";
import { statsd } from "config/statsd";
import { metricError } from "config/metric-names";
import { groupBy, countBy } from "lodash";
import { ConnectionSyncStatus } from "~/spa/src/rest-interfaces";

interface FailedConnection {
	id: number;
	deleted: boolean;
	orgName?: string;
}
export interface InstallationResults {
	fulfilled: AppInstallation[];
	rejected: FailedAppInstallation[];
	total: number;
}
interface SuccessfulConnection extends AppInstallation {
	isGlobalInstall: boolean;
}
interface ConnectionsAndInstallations extends GitHubCloudObj {
	installations: InstallationResults
}
interface GitHubCloudObj {
	successfulConnections: SuccessfulConnection[]
	failedConnections: FailedConnection[]
}

export const mapSyncStatus = (syncStatus: SyncStatus = SyncStatus.PENDING): ConnectionSyncStatus => {
	switch (syncStatus) {
		case "ACTIVE":
			return "IN PROGRESS";
		case "COMPLETE":
			return "FINISHED";
		default:
			return syncStatus as ConnectionSyncStatus;
	}
};

export const getInstallations = async (subscriptions: Subscription[], log: Logger, gitHubAppId: number | undefined): Promise<InstallationResults> => {
	const installations = await Promise.allSettled(subscriptions.map((sub) => getInstallation(sub, gitHubAppId, log)));
	// Had to add "unknown" in between type as lodash, types is incorrect for groupBy of `installations`
	const connections = groupBy(installations, "status") as unknown as { fulfilled?: PromiseFulfilledResult<AppInstallation>[], rejected?: PromiseRejectedResult[] };
	const fulfilled = connections.fulfilled?.map(v => v.value) || [];
	const rejected = connections.rejected?.map(v => v.reason as FailedAppInstallation) || [];
	return {
		fulfilled,
		rejected,
		total: fulfilled.length + rejected.length
	};
};

export const getRetryableFailedSyncErrors = async (subscription: Subscription) => {
	const RETRYABLE_ERROR_CODES = ["PERMISSIONS_ERROR", "CONNECTION_ERROR"];
	const failedSyncs = await RepoSyncState.getFailedFromSubscription(subscription);
	const errorCodes = failedSyncs.map(sync => sync.failedCode);
	const retryableErrorCodes = errorCodes.filter(errorCode => errorCode && RETRYABLE_ERROR_CODES.includes(errorCode));

	if (retryableErrorCodes.length === 0) {
		return undefined;
	}
	return countBy(retryableErrorCodes);
};
const getInstallation = async (subscription: Subscription, gitHubAppId: number | undefined, log: Logger): Promise<AppInstallation> => {
	const { jiraHost, gitHubInstallationId } = subscription;
	const gitHubAppClient = await createAppClient(log, jiraHost, gitHubAppId, { trigger: "jira-get" });
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	try {
		const response = await gitHubAppClient.getInstallation(gitHubInstallationId);
		return {
			...response.data,
			subscriptionId: subscription.id,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			syncStatus: mapSyncStatus(subscription.syncStatus),
			syncWarning: subscription.syncWarning,
			totalNumberOfRepos: subscription.totalNumberOfRepos,
			numberOfSyncedRepos: await RepoSyncState.countFullySyncedReposForSubscription(subscription),
			backfillSince: subscription.backfillSince,
			failedSyncErrors: await getRetryableFailedSyncErrors(subscription),
			jiraHost
		};

	} catch (err) {
		log.error(
			{ installationId: gitHubInstallationId, error: err as unknown, uninstalled: (err as Response).status === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection, { gitHubProduct }, { jiraHost });
		return Promise.reject({ error: err as unknown, id: gitHubInstallationId, deleted: (err as Response).status === 404 });
	}
};

export const getConnectionsAndInstallations = async (subscriptions: Subscription[], req: Request, githubAppId?: number): Promise<ConnectionsAndInstallations> => {
	const installations = await getInstallations(subscriptions, req.log, githubAppId);

	const failedConnections: FailedConnection[] = await Promise.all(
		installations.rejected.map(async (installation) => {
			const sub = subscriptions.find((sub: Subscription) => installation.id === sub.gitHubInstallationId);
			const repo = sub && await RepoSyncState.findOneFromSubscription(sub);
			return {
				id: installation.id,
				deleted: installation.deleted,
				orgName: repo?.repoOwner
			};
		}));

	const successfulConnections: SuccessfulConnection[] = installations.fulfilled
		.map((installation) => ({
			...installation,
			isGlobalInstall: installation.repository_selection === "all"
		}));

	return { installations, successfulConnections, failedConnections };
};

export const countStatus = (connections: SuccessfulConnection[], syncStatus: string): number =>
	connections.filter(org => org.syncStatus === syncStatus).length || 0;

export const countNumberSkippedRepos = (connections: SuccessfulConnection[]): number => {
	return connections.reduce((acc, obj) => acc + (obj.totalNumberOfRepos || 0) - (obj.numberOfSyncedRepos || 0) , 0);
};
