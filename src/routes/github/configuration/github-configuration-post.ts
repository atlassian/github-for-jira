import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { createAppClient, createUserClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";

const hasAdminAccess = async (gitHubAppClient: GitHubAppClient, gitHubUserClient: GitHubUserClient, gitHubInstallationId: number, logger: Logger): Promise<boolean>  => {
	try {
		logger.info("Fetching info about user");
		const { data: { login } } = await gitHubUserClient.getUser();

		logger.info("Fetching info about installation");
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);

		logger.info("Checking if the user is an admin");
		return await isUserAdminOfOrganization(gitHubUserClient, installation.account.login, login, installation.target_type, logger);
	}	catch (err) {
		logger.warn({ err }, "Error checking user access");
		return false;
	}
};

/**
 * Handle the when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppId } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId) {
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	if (!req.body.clientKey) {
		res.status(400)
			.json({
				err: "A clientKey must be provided to link an installation."
			});
		return;
	}

	req.addLogFields({ gitHubInstallationId });
	req.log.debug("Received add subscription request");

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
		const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId);

		// Check if the user that posted this has access to the installation ID they're requesting
		if (!await hasAdminAccess(gitHubAppClient, gitHubUserClient, gitHubInstallationId, req.log)) {
			req.log.warn(`Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation`);
			res.status(401).json({ err: `User is not an admin of the installation` });
			return;
		}

		const subscription: Subscription = await Subscription.install({
			hashedClientKey: req.body.clientKey,
			installationId: gitHubInstallationId,
			host: jiraHost,
			gitHubAppId
		});

		await Promise.all(
			[
				saveConfiguredAppProperties(jiraHost, req.log, true),
				findOrStartSync(subscription, req.log, "full", undefined, undefined, {
					"source": "initial-sync"
				})
			]
		);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.ConnectToOrgTrackEventName,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
			jiraHost,
			success: true,
			gitHubProduct
		});

		res.sendStatus(200);
	} catch (err) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.ConnectToOrgTrackEventName,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
			jiraHost,
			success: false,
			gitHubProduct
		});

		req.log.error({ err, gitHubProduct }, "Error processing subscription add request");
		res.sendStatus(500);
	}
};
