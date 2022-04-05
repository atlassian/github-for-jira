import { Subscription, SyncStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { NextFunction, Request, Response } from "express";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { AppInstallation, FailedAppInstallation } from "config/interfaces";
import { GitHubAPI } from "probot";
import Logger from "bunyan";
import { groupBy } from "lodash";
import {sendAnalytics} from "../../../util/analytics-client";
import {AnalyticsEventTypesEnum, AnalyticsScreenEventsEnum} from "../../../interfaces/common";

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

export interface InstallationResults {
	fulfilled: AppInstallation[];
	rejected: FailedAppInstallation[];
	total: number;
}

export const getInstallations = async (client: GitHubAPI, subscriptions: Subscription[], log?: Logger): Promise<InstallationResults> => {
	const installations = await Promise.allSettled(subscriptions.map((sub) => getInstallation(client, sub, log)));
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

const getInstallation = async (client: GitHubAPI, subscription: Subscription, log?: Logger): Promise<AppInstallation> => {
	const id = subscription.gitHubInstallationId;
	try {
		const response = await client.apps.getInstallation({ installation_id: id });

		return {
			...response.data,
			syncStatus: mapSyncStatus(subscription.syncStatus),
			syncWarning: subscription.syncWarning,
			totalNumberOfRepos: await RepoSyncState.countFromSubscription(subscription),
			numberOfSyncedRepos: await RepoSyncState.countSyncedReposFromSubscription(subscription),
			jiraHost: subscription.jiraHost
		};

	} catch (err) {
		log?.error(
			{ installationId: id, error: err, uninstalled: err.code === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection);

		return Promise.reject({ error: err, id, deleted: err.code === 404 });
	}
};

interface FailedConnection {
	id: number;
	deleted: boolean;
	orgName?: string;
}

interface SuccessfulConnection extends AppInstallation {
	isGlobalInstall: boolean;
}

export const JiraConfigurationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const jiraHost = res.locals.jiraHost;

		if (!jiraHost) {
			req.log.warn({ jiraHost, req, res }, "Missing jiraHost");
			res.status(404).send(`Missing Jira Host '${jiraHost}'`);
			return;
		}

		req.log.info("Received jira configuration page request");

		const { client } = res.locals;
		const subscriptions = await Subscription.getAllForHost(jiraHost);
		const installations = await getInstallations(client, subscriptions, req.log);

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

		res.render("jira-configuration.hbs", {
			host: jiraHost,
			successfulConnections,
			failedConnections,
			hasConnections: !!installations.total,
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce
		});

		sendAnalytics(AnalyticsEventTypesEnum.ScreenEvent, { name: AnalyticsScreenEventsEnum.GitHubConfigScreenEventName, jiraHost, connectedOrgCount: installations.total })

		req.log.info("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
