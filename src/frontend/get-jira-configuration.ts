import format from "date-fns/format";
import moment from "moment";
import { Subscription } from "../models";
import { NextFunction, Request, Response } from "express";
import statsd from "../config/statsd";
import { metricSyncStatus, metricError } from "../config/metric-names";
import * as Sentry from "@sentry/node";

const syncStatus = (syncStatus) =>
	syncStatus === "ACTIVE" ? "IN PROGRESS" : syncStatus;

const sendFailedStatusMetrics = (installationId: string, req: Request): void => {
	const syncError = "No updates in the last 15 minutes";
	req.log.warn({ installationId, error: syncError }, "Sync failed");

	Sentry.setExtra("Installation FAILED", syncError);
	Sentry.captureException(syncError);

	statsd.increment(metricSyncStatus.failed);
};

export async function getInstallation(client, subscription, req?: Request) {
	const id = subscription.gitHubInstallationId;
	try {
		const response = await client.apps.getInstallation({ installation_id: id });
		response.data.syncStatus = subscription.hasInProgressSyncFailed()
			? "FAILED"
			: syncStatus(subscription.syncStatus);
		response.data.syncWarning = subscription.syncWarning;
		response.data.subscriptionUpdatedAt = formatDate(subscription.updatedAt);
		response.data.totalNumberOfRepos = Object.keys(
			subscription.repoSyncState?.repos || {}
		).length;
		response.data.numberOfSyncedRepos =
			subscription.repoSyncState?.numberOfSyncedRepos || 0;
		response.data.jiraHost = subscription.jiraHost;

		response.data.syncStatus === "FAILED" && sendFailedStatusMetrics(id, req);

		return response.data;
	} catch (err) {
		req.log.error(
			{ installationId: id, error: err, uninstalled: err.code === 404 },
			"Failed connection"
		);
		statsd.increment(metricError.failedConnection);

		return { error: err, id, deleted: err.code === 404 };
	}
}

const formatDate = function (date) {
	return {
		relative: moment(date).fromNow(),
		absolute: format(date, "MMMM D, YYYY h:mm a"),
	};
};

export default async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const jiraHost = req.session.jiraHost;

		req.log.info("Received jira configuration page request");

		const { client } = res.locals;
		const subscriptions = await Subscription.getAllForHost(jiraHost);
		const installations = await Promise.all(
			subscriptions.map((subscription) =>
				getInstallation(client, subscription, req)
			)
		);

		const connections = installations
			.filter((response) => !response.error)
			.map((data) => ({
				...data,
				isGlobalInstall: data.repository_selection === "all",
				installedAt: formatDate(data.updated_at),
				syncState: data.syncState,
				repoSyncState: data.repoSyncState,
			}));

		const failedConnections = installations.filter(
			(response) => !!response.error
		);

		res.render("jira-configuration.hbs", {
			host: jiraHost,
			connections,
			failedConnections,
			hasConnections: connections.length > 0 || failedConnections.length > 0,
			APP_URL: process.env.APP_URL,
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
		});

		req.log.info("Jira configuration rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
