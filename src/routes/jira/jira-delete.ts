import Logger from "bunyan";
import { Errors } from "config/errors";
import { Request, Response } from "express";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { Subscription } from "models/subscription";
import { sendAnalytics } from "utils/analytics-client";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { BooleanFlags, booleanFlag } from "~/src/config/feature-flags";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { Installation } from "~/src/models/installation";
import { JiraClient } from "~/src/models/jira-client";
import { isConnected } from "utils/is-connected";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

/**
 * Handle the when a user deletes an entry in the UI
 *
 */
export const JiraDelete = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, installation } = res.locals;
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
	if (await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost)) {
		await deleteSecurityWorkspaceLinkAndVulns(installation, subscription, req.log);
		req.log.info({ subscriptionId: subscription.id }, "Deleted security workspace and vulnerabilities");
	}
	await subscription.destroy();

	if (!(await isConnected(jiraHost))) {
		await saveConfiguredAppProperties(jiraHost, req.log, false);
	}

	await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
		action: AnalyticsTrackEventsEnum.DisconnectToOrgTrackEventName,
		actionSubject: AnalyticsTrackEventsEnum.DisconnectToOrgTrackEventName,
		source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
	}, {
		gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppId)
	});

	res.sendStatus(204);
};

const deleteSecurityWorkspaceLinkAndVulns = async (
	installation: Installation,
	subscription: Subscription,
	logger: Logger
) => {

	try {
		logger.info("Fetching info about GitHub installation");

		const jiraClient = await JiraClient.getNewClient(installation, logger);
		await Promise.allSettled([
			jiraClient.deleteWorkspace(subscription.id),
			jiraClient.deleteVulnerabilities(subscription.id)
		]);
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to delete security workspace or vulnerabilities from Jira");
	}

};
