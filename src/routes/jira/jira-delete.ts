import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { Request, Response } from "express";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { Errors } from "config/errors";

/**
 * Handle the when a user deletes an entry in the UI
 *
 */
export const JiraDelete = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost } = res.locals;
	// TODO: The params `installationId` needs to be replaced by `subscriptionId`
	const gitHubInstallationId = Number(req.params.installationId) || Number(req.body.gitHubInstallationId);
	const gitHubAppId = req.body.appId;
	req.log.info({ gitHubInstallationId, gitHubAppId }, "Received Jira DELETE subscription request");

	if (!jiraHost) {
		req.log.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}

	if (!gitHubInstallationId) {
		req.log.error("Missing Github Installation ID");
		res.status(401).send("Missing Github Installation ID");
		return;
	}

	if (!gitHubAppId) {
		req.log.info("No gitHubAppId passed. Disconnecting cloud subscription.");
	}

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		gitHubInstallationId,
		gitHubAppId
	);

	if (!subscription) {
		req.log.warn("Cannot find subscription");
		res.status(404).send("Cannot find Subscription");
		return;
	}

	const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, gitHubAppId, req.log);

	// jiraClient is null when jiraHost is an empty string which we know is defined above.
	await jiraClient!.devinfo.installation.delete(gitHubInstallationId);
	await subscription.destroy();

	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name: AnalyticsTrackEventsEnum.DisconnectToOrgTrackEventName,
		source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
		gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppId)
	});

	res.sendStatus(204);
};
