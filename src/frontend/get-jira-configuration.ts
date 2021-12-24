import format from "date-fns/format";
import moment from "moment";
import SubscriptionClass, { SyncStatus } from "../models/subscription";
import { RepoSyncState, Subscription } from "../models";
import { NextFunction, Request, Response } from "express";
import statsd from "../config/statsd";
import { metricError } from "../config/metric-names";
import { FailedInstallations } from "../config/interfaces";
import Logger from "bunyan";

function mapSyncStatus(syncStatus: SyncStatus = SyncStatus.PENDING): string {
	switch (syncStatus) {
		case "ACTIVE":
			return "IN PROGRESS";
		case "COMPLETE":
			return "FINISHED";
		default:
			return syncStatus;
	}
}

export async function getInstallation(client, subscription: SubscriptionClass, reqLog?: Logger) {
	const id = subscription.gitHubInstallationId;
	try {
		const response = await client.apps.getInstallation({ installation_id: id });
		response.data.syncStatus = mapSyncStatus(subscription.syncStatus);
		response.data.syncWarning = subscription.syncWarning;
		response.data.subscriptionUpdatedAt = formatDate(subscription.updatedAt);
		response.data.totalNumberOfRepos = await RepoSyncState.countFromSubscription(subscription);
		response.data.numberOfSyncedRepos = await RepoSyncState.countSyncedReposFromSubscription(subscription);
		response.data.jiraHost = subscription.jiraHost;

		return response.data;
	} catch (err) {
		reqLog?.error(
			{ installationId: id, error: err, uninstalled: err.code === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection);

		return { error: err, id, deleted: err.code === 404 };
	}
}

const formatDate = function(date) {
	return {
		relative: moment(date).fromNow(),
		absolute: format(date, "MMMM D, YYYY h:mm a")
	};
};

interface FailedConnections {
	id: number;
	deleted: boolean;
	orgName: string | undefined;
}

export const getFailedConnections = async (
	installations: FailedInstallations[],
	subscriptions: SubscriptionClass[]
): Promise<FailedConnections[]> => {
	return Promise.all(installations
		.filter((response) => !!response.error)
		.map(async (failedConnection: FailedInstallations) => {
			const sub = subscriptions.find(sub => failedConnection.id === sub.gitHubInstallationId);
			const repo = sub && await RepoSyncState.findOneFromSubscription(sub);
			const orgName = repo?.repoOwner;

			return {
				id: failedConnection.id,
				deleted: failedConnection.deleted,
				orgName
			};
		}));
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
		const installations = await Promise.all(
			subscriptions.map((subscription) =>
				getInstallation(client, subscription, req.log)
			)
		);

		const failedConnections = await getFailedConnections(
			installations,
			subscriptions
		);

		const connections = installations
			.filter((response) => !response.error)
			.map((data) => ({
				...data,
				isGlobalInstall: data.repository_selection === "all",
				installedAt: formatDate(data.updated_at),
				syncState: data.syncState
			}));

		const hasConnections =
			connections.length > 0 || failedConnections.length > 0;

		res.render("jira-configuration.hbs", {
			host: jiraHost,
			connections,
			failedConnections,
			hasConnections,
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce
		});

		req.log.info("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
