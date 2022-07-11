import Logger from "bunyan";
import { groupBy, chain } from "lodash";
import { NextFunction, Request, Response } from "express";
import { Subscription, SyncStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { AppInstallation, FailedAppInstallation } from "config/interfaces";
import { createAppClient } from "~/src/util/get-github-client-config";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { isGitHubCloudApp } from "~/src/util/jira-utils";
import { GitHubServerApp } from "models/github-server-app";

interface FailedConnection {
	id: number;
	deleted: boolean;
	orgName?: string;
}

interface SuccessfulConnection extends AppInstallation {
	isGlobalInstall: boolean;
}

interface ConnectionsAndInstallations {
	successfulConnections: SuccessfulConnection[]
	failedConnections: FailedConnection[]
	installations: InstallationResults
}

export interface InstallationResults {
	fulfilled: AppInstallation[];
	rejected: FailedAppInstallation[];
	total: number;
}

type GitHubAppServerAppWithConnections = GitHubServerApp & ConnectionsAndInstallations;

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
	const { jiraHost } = subscription;
	const { gitHubInstallationId } = subscription;
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

const getConnectionsAndInstallations = async (subscriptions: Subscription[], req: Request, id: number): Promise<ConnectionsAndInstallations> => {
	const installations = await getInstallations(subscriptions, req.log, id);

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

export const JiraConfigurationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const { jiraHost, gitHubAppId } = res.locals;

		if (!jiraHost) {
			req.log.warn({ jiraHost, req, res }, "Missing jiraHost");
			res.status(404).send(`Missing Jira Host '${jiraHost}'`);
			return;
		}

		req.log.debug("Received jira configuration page request");

		const subscriptions = await Subscription.getAllForHost(jiraHost);
		const { installations, successfulConnections, failedConnections } = await getConnectionsAndInstallations(subscriptions, req, gitHubAppId);

		const gheServers = await GitHubServerApp.findForInstallationId(res.locals.installation.id) as GitHubAppServerAppWithConnections[];

		// Grouping the list of servers by `gitHubBaseUrl`
		const modifiedGHEServers = await Promise.all(chain(gheServers).groupBy("gitHubBaseUrl")
			.map(async (value, key) => ({
				gitHubBaseUrl: key,
				// Fetching the subscriptions for each GH Server App
				applications: await Promise.all(value.map(async (app) => {
					const {
						successfulConnections,
						failedConnections
					} = await getConnectionsAndInstallations(subscriptions, req, app.id);
					app.successfulConnections = successfulConnections;
					app.failedConnections = failedConnections;

					return app;
				}))
			})).value());


		const gheServerEnabled = await booleanFlag(BooleanFlags.GHE_SERVER, false, jiraHost);

		const handleNavigationClassName = gheServerEnabled ? "select-github-version-link" : "add-organization-link";
		const config = gheServerEnabled ? {
			host: jiraHost,
			gheServers: modifiedGHEServers,
			ghCloud: { successfulConnections, failedConnections },
			hasConnections: !!(installations.total || gheServers?.length),
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			handleNavigationClassName
		} : {
			host: jiraHost,
			successfulConnections,
			failedConnections,
			hasConnections: !!installations.total,
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			handleNavigationClassName,
			isGitHubCloudApp: await isGitHubCloudApp(gitHubAppId)
		};

		res.render(gheServerEnabled ? "jira-configuration-new.hbs" : "jira-configuration.hbs", config);

		req.log.debug("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
