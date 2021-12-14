import format from "date-fns/format";
import moment from "moment";
import { Subscription } from "../models";
import SubscriptionClass from "../models/subscription";
import { NextFunction, Request, Response } from "express";
import statsd from "../config/statsd";
import { metricError } from "../config/metric-names";
import { FailedAppInstallation } from "../config/interfaces";
import { GitHubAPI } from "probot";
import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import _ from "lodash";

function mapSyncStatus(syncStatus?: string): string | undefined {
	switch (syncStatus) {
		case "ACTIVE":
			return "IN PROGRESS";
		case "COMPLETE":
			return "FINISHED";
		default:
			return syncStatus;
	}
}

interface AppInstallation extends Octokit.AppsGetInstallationResponse {
	syncStatus?: string;
	syncWarning?: string;
	subscriptionUpdatedAt: DateFormat;
	totalNumberOfRepos: number;
	numberOfSyncedRepos: number;
	jiraHost: string;
}

export async function getInstallations(client: GitHubAPI, subscription: SubscriptionClass, reqLog?: Logger): Promise<AppInstallation> {
	const id = subscription.gitHubInstallationId;
	try {
		const response = await client.apps.getInstallation({ installation_id: id });
		return {
			...response.data,
			syncStatus: mapSyncStatus(subscription.syncStatus),
			syncWarning: subscription.syncWarning,
			subscriptionUpdatedAt: formatDate(subscription.updatedAt),
			totalNumberOfRepos: Object.keys(
				subscription.repoSyncState?.repos || {}
			).length,
			numberOfSyncedRepos:
				subscription.repoSyncState?.numberOfSyncedRepos || 0,
			jiraHost: subscription.jiraHost
		};
	} catch (err) {
		reqLog?.error(
			{ installationId: id, error: err, uninstalled: err.code === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection);

		return Promise.reject({ error: err, id, deleted: err.code === 404 });
	}
}

interface DateFormat {
	relative: string;
	absolute: string;
}

const formatDate = (date) => ({
	relative: moment(date).fromNow(),
	absolute: format(date, "MMMM D, YYYY h:mm a")
});

interface FailedConnections {
	id: number;
	deleted: boolean;
	orgName: string | undefined;
}

export const getFailedConnections = (
	installations: (AppInstallation | FailedAppInstallation)[],
	subscriptions: SubscriptionClass[]
): FailedConnections[] => {
	return installations
		.filter((response):response is FailedAppInstallation => !!(response as FailedAppInstallation).error)
		.map((failedConnection) => {
			const sub = subscriptions.find(
				(subscription: SubscriptionClass) =>
					failedConnection.id === subscription.gitHubInstallationId
			);
			const repos = sub?.repoSyncState?.repos || {};
			const repoId = Object.keys(repos);
			const orgName = repos[repoId[0]]?.repository?.owner.login || undefined;

			return {
				id: failedConnection.id,
				deleted: failedConnection.deleted,
				orgName
			};
		});
};

export default async (
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
		const installations = await Promise.allSettled(
			subscriptions.map((subscription) => getInstallations(client, subscription, req.log)));


		const connections = _.groupBy(installations, "status");

		const failedConnections = getFailedConnections(
			installations,
			subscriptions
		);

		const successfulConnections = installations
			.filter((response) => !response.error)
			.map((data) => ({
				...data,
				isGlobalInstall: data.repository_selection === "all",
				installedAt: formatDate(data.updated_at),
				syncState: data.syncState,
				repoSyncState: data.repoSyncState
			}));

		res.render("jira-configuration.hbs", {
			host: jiraHost,
			connections,
			failedConnections,
			hasConnections: !!installations.length,
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce
		});

		req.log.info("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
