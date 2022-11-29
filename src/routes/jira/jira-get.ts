import Logger from "bunyan";
import { groupBy, chain, difference } from "lodash";
import { NextFunction, Request, Response } from "express";
import { Subscription, SyncStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { AppInstallation, FailedAppInstallation } from "config/interfaces";
import { createAppClient } from "utils/get-github-client-config";
import { booleanFlag, BooleanFlags, GHE_SERVER_GLOBAL } from "config/feature-flags";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { saveConfiguredAppProperties } from  "~/src/util/app-properties-utils";

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

const mapSyncStatus = (syncStatus: SyncStatus = SyncStatus.PENDING): string => {
	switch (syncStatus) {
		case "ACTIVE":
			return "IN PROGRESS";
		case "COMPLETE":
			return "FINISHED";
		default:
			return syncStatus;
	}
};

export const getInstallations = async (subscriptions: Subscription[], log: Logger, gitHubAppId: number | undefined): Promise<InstallationResults> => {
	const installations = await Promise.allSettled(subscriptions.map((sub) => getInstallation(sub, gitHubAppId, log)));
	// Had to add "unknown" in between type as lodash types is incorrect for
	const connections = groupBy(installations, "status") as unknown as { fulfilled: PromiseFulfilledResult<AppInstallation>[], rejected: PromiseRejectedResult[] };
	const fulfilled = connections.fulfilled?.map(v => v.value) || [];
	const rejected = connections.rejected?.map(v => v.reason as FailedAppInstallation) || [];
	return {
		fulfilled,
		rejected,
		total: fulfilled.length + rejected.length
	};
};

const getInstallation = async (subscription: Subscription, gitHubAppId: number | undefined, log: Logger): Promise<AppInstallation> => {
	const { jiraHost, gitHubInstallationId } = subscription;
	const gitHubAppClient = await createAppClient(log, jiraHost, gitHubAppId);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	try {
		const response = await gitHubAppClient.getInstallation(gitHubInstallationId);
		return {
			...response.data,
			syncStatus: mapSyncStatus(subscription.syncStatus),
			syncWarning: subscription.syncWarning,
			totalNumberOfRepos: subscription.totalNumberOfRepos,
			numberOfSyncedRepos: await RepoSyncState.countSyncedReposFromSubscription(subscription),
			jiraHost
		};

	} catch (err) {
		log.error(
			{ installationId: gitHubInstallationId, error: err, uninstalled: err.status === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection, { gitHubProduct });
		return Promise.reject({ error: err, id: gitHubInstallationId, deleted: err.status === 404 });
	}
};

const getConnectionsAndInstallations = async (subscriptions: Subscription[], req: Request, githubAppId?: number): Promise<ConnectionsAndInstallations> => {
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

const countStatus = (connections: SuccessfulConnection[], syncStatus: string): number =>
	connections.filter(org => org?.syncStatus === syncStatus).length || 0;

const countNumberSkippedRepos = (connections: SuccessfulConnection[]): number => {
	return connections.reduce((acc, obj) => acc + (obj?.totalNumberOfRepos || 0) - (obj?.numberOfSyncedRepos || 0) , 0);
};

const renderJiraCloud = async (res: Response, req: Request): Promise<void> => {
	const { jiraHost, nonce } = res.locals;
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(subscriptions, req);
	const hasConnections = !!installations.total;

	if (!hasConnections) {
		await saveConfiguredAppProperties(jiraHost, undefined, undefined, req.log, false);
	}

	res.render("jira-configuration.hbs", {
		host: jiraHost,
		successfulConnections,
		failedConnections,
		hasConnections,
		APP_URL: process.env.APP_URL,
		csrfToken: req.csrfToken(),
		nonce
	});

	const completeConnections = successfulConnections.filter(connection => connection.syncStatus === "FINISHED");

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.GitHubConfigScreenEventName,
		jiraHost,
		connectedOrgCount: installations.total,
		failedCloudBackfillCount: countStatus(successfulConnections, "FAILED"),
		successfulCloudBackfillCount: countStatus(successfulConnections, "FINISHED"),
		numberOfSkippedRepos: countNumberSkippedRepos(completeConnections),
		hasConnections
	});
};

const renderJiraCloudAndEnterpriseServer = async (res: Response, req: Request): Promise<void> => {
	const { jiraHost, nonce } = res.locals;
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const gheServers: GitHubServerApp[] = await GitHubServerApp.findForInstallationId(res.locals.installation.id) || [];

	// Separating the subscriptions for GH cloud and GHE servers
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);
	const gheServerSubscriptions = difference(subscriptions, ghCloudSubscriptions);

	// Connections for GHCloud
	const {
		installations,
		successfulConnections: successfulCloudConnections,
		failedConnections: failedCloudConnections
	} = await getConnectionsAndInstallations(ghCloudSubscriptions, req);

	// Connections for GH Enterprise
	const gheServersWithConnections = await Promise.all(gheServers.map(async (server: GitHubServerApp) => {
		const subscriptionsForServer = gheServerSubscriptions.filter(subscription => subscription.gitHubAppId === server.id);
		const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(subscriptionsForServer, req, server.id);

		/**
		 * Directly fetching the values using `dataValues`,
		 * Couldn't get the value using `{plan: true}`, it throws a crypto error,
		 */
		return { ...(server as any).dataValues, successfulConnections, failedConnections, installations };
	}));

	// Grouping the list of servers by `gitHubBaseUrl`
	const groupedGheServers = chain(gheServersWithConnections).groupBy("gitHubBaseUrl")
		.map((value, key) => ({
			gitHubBaseUrl: key,
			applications: value
		})).value();

	const hasConnections =  !!(installations.total || gheServers?.length);

	if (!hasConnections) {
		await saveConfiguredAppProperties(jiraHost, undefined, undefined, req.log, false);
	}

	res.render("jira-configuration-new.hbs", {
		host: jiraHost,
		gheServers: groupedGheServers,
		ghCloud: { successfulCloudConnections, failedCloudConnections },
		hasCloudAndEnterpriseServers: !!((successfulCloudConnections.length || failedCloudConnections.length) && gheServers.length),
		hasCloudServers: !!(successfulCloudConnections.length || failedCloudConnections.length),
		hasConnections,
		APP_URL: process.env.APP_URL,
		csrfToken: req.csrfToken(),
		nonce
	});

	const successfulServerConnections = gheServersWithConnections
		.reduce((acc, obj) => acc + obj.successfulConnections?.length, 0);
	const allSuccessfulConnections = [...successfulCloudConnections, ...gheServersWithConnections];
	const completeConnections = allSuccessfulConnections.filter(connection => connection.syncStatus === "FINISHED");

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.GitHubConfigScreenEventName,
		jiraHost,
		connectedOrgCountCloudCount: successfulCloudConnections.length,
		connectedOrgCountServerCount: successfulServerConnections,
		totalOrgCount: successfulCloudConnections.length + successfulServerConnections,
		failedCloudBackfillCount: countStatus(successfulCloudConnections, "FAILED"),
		failedServerBackfillCount: countStatus(gheServersWithConnections, "FAILED"),
		successfulCloudBackfillCount: countStatus(successfulCloudConnections, "FINISHED"),
		successfulServerBackfillCount: countStatus(gheServersWithConnections, "FINISHED"),
		numberOfSkippedRepos: countNumberSkippedRepos(completeConnections),
		hasConnections
	});
};

export const JiraGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const { jiraHost } = res.locals;

		if (!jiraHost) {
			req.log.warn({ jiraHost, req, res }, "Missing jiraHost");
			res.status(404).send(`Missing Jira Host '${jiraHost}'`);
			return;
		}

		req.log.debug("Received jira configuration page request");

		if (await booleanFlag(BooleanFlags.GHE_SERVER, GHE_SERVER_GLOBAL, jiraHost)) {
			await renderJiraCloudAndEnterpriseServer(res, req);
		} else {
			await renderJiraCloud(res, req);
		}
		req.log.debug("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
