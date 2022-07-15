import Logger from "bunyan";
import { groupBy, chain, difference } from "lodash";
import { NextFunction, Request, Response } from "express";
import { Subscription, SyncStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { AppInstallation, FailedAppInstallation } from "config/interfaces";
import { createAppClient } from "~/src/util/get-github-client-config";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubServerApp } from "models/github-server-app";

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

interface ConnectionsAndInstallations {
	successfulConnections: SuccessfulConnection[]
	failedConnections: FailedConnection[]
	installations: InstallationResults
}

interface GitHubCloudObj {
	successfulConnections: SuccessfulConnection[]
	failedConnections: FailedConnection[]
}

interface GitHubServerObj {
	gitHubBaseUrl:string
	applications: ConnectionsAndInstallations[]
}

interface ViewConfigurationForGHCloud {
	host: string
	successfulConnections: SuccessfulConnection[]
	failedConnections: FailedConnection[]
	hasConnections: boolean
	APP_URL?: string
	csrfToken: string
	nonce: string
}
interface ViewConfigurationForGHE {
	host: string
	gheServers: GitHubServerObj[]
	ghCloud: GitHubCloudObj
	hasConnections: boolean
	APP_URL?: string
	csrfToken: string
	nonce: string
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

export const getInstallations = async (subscriptions: Subscription[], log: Logger, gitHubAppId?: number): Promise<InstallationResults> => {
	const installations = await Promise.allSettled(subscriptions.map((sub) => getInstallation(sub, log, gitHubAppId)));
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

const getInstallation = async (subscription: Subscription, log: Logger, gitHubAppId?: number): Promise<AppInstallation> => {
	const { jiraHost, gitHubInstallationId } = subscription;
	const gitHubAppClient = await createAppClient(log, jiraHost, gitHubAppId);

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
		statsd.increment(metricError.failedConnection);

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

const JiraCloudConfiguration = async (res: Response, req: Request): Promise<ViewConfigurationForGHCloud> => {
	const { jiraHost, nonce } = res.locals;
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(subscriptions, req);

	return {
		host: jiraHost,
		successfulConnections,
		failedConnections,
		hasConnections: !!installations.total,
		APP_URL: process.env.APP_URL,
		csrfToken: req.csrfToken(),
		nonce
	};
};

const JiraCloudAndEnterpriseConfiguration = async (res: Response, req: Request): Promise<ViewConfigurationForGHE> => {
	const { jiraHost, nonce } = res.locals;
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const gheServers = await GitHubServerApp.findForInstallationId(res.locals.installation.id) || [];

	// Separating the subscriptions for GH cloud and GHE servers
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);
	const gheServerSubscriptions = difference(subscriptions, ghCloudSubscriptions);

	// Connections for GHCloud
	const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(ghCloudSubscriptions, req);

	// Connections for GH Enterprise
	const gheServersWithConnections = await Promise.all(gheServers.map(async (server) => {
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

	return {
		host: jiraHost,
		gheServers: groupedGheServers,
		ghCloud: { successfulConnections, failedConnections },
		hasConnections: !!(installations.total || gheServers?.length),
		APP_URL: process.env.APP_URL,
		csrfToken: req.csrfToken(),
		nonce
	};
};

export const JiraConfigurationGet = async (
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

		if (await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost)) {
			res.render("jira-configuration-new.hbs", await JiraCloudAndEnterpriseConfiguration(res, req));
		} else {
			res.render("jira-configuration.hbs", await JiraCloudConfiguration(res, req));
		}
		req.log.debug("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
