import { createAppClient, createUserClient } from "utils/get-github-client-config";
import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import Logger from "bunyan";
import { Installation } from "models/installation";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { GitHubServerApp } from "models/github-server-app";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const hasAdminAccess = async (githubToken: string, jiraHost: string, gitHubInstallationId: number, logger: Logger, gitHubServerAppIdPk?: number): Promise<boolean>  => {
	const metrics = {
		trigger: "github-configuration-post"
	};
	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, metrics, logger, gitHubServerAppIdPk);
		const gitHubAppClient = await createAppClient(logger, jiraHost, gitHubServerAppIdPk, metrics);

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

export const getAvatarUrl = async (
	logger: Logger,
	jiraHost: string,
	gitHubInstallationId: number,
	metrics: {
		trigger: string
	},
	gitHubServerAppIdPk?: number
): Promise<string> => {
	const gitHubAppClient = await createAppClient(logger, jiraHost, gitHubServerAppIdPk, metrics);
	const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);
	return installation.account.avatar_url;
};

const calculateWithApiKeyFlag = async (installation: Installation, gitHubAppId: number) => {
	const maybeApp = (await GitHubServerApp.findForInstallationId(installation.id))?.find(app => app.appId === gitHubAppId);
	return !!maybeApp?.apiKeyHeaderName;
};

export interface ResultObject {
	error?: string;
}

export const verifyAdminPermsAndFinishInstallation =
	async (
		githubToken: string,
		installation: Installation,
		gitHubServerAppIdPk: number | undefined,
		gitHubInstallationId: number,
		parentLogger: Logger
	): Promise<ResultObject> => {

		const log = parentLogger.child({ gitHubInstallationId });
		const { jiraHost, clientKey } = installation;
		log.debug("Received add subscription request");

		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubServerAppIdPk);

		try {
			// Check if the user that posted this has access to the installation ID they're requesting
			if (!await hasAdminAccess(githubToken, jiraHost, gitHubInstallationId, log, gitHubServerAppIdPk)) {
				log.warn(`Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation`);
				return {
					error: "`User is not an admin of the installation"
				};
			}

			const metrics = {
				trigger: "github-configuration-post"
			};

			const avatarUrl = await getAvatarUrl(
				log,
				jiraHost,
				gitHubInstallationId,
				metrics,
				gitHubServerAppIdPk
			);

			const subscription: Subscription = await Subscription.install({
				hashedClientKey: clientKey,
				installationId: gitHubInstallationId,
				host: jiraHost,
				gitHubAppId: gitHubServerAppIdPk,
				avatarUrl
			});

			log.info({ subscriptionId: subscription.id }, "Subscription was created");

			await Promise.all(
				[
					saveConfiguredAppProperties(installation.jiraHost, log, true),
					findOrStartSync(subscription, log, "full", undefined, undefined, {
						source: "initial-sync"
					})
				]
			);

			sendAnalytics(AnalyticsEventTypes.TrackEvent, {
				name: AnalyticsTrackEventsEnum.ConnectToOrgTrackEventName,
				source: !gitHubServerAppIdPk ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
				jiraHost: installation.jiraHost,
				withApiKey: gitHubServerAppIdPk ? await calculateWithApiKeyFlag(installation, gitHubServerAppIdPk) : false,
				success: true,
				gitHubProduct
			});

			return { };
		} catch (err) {

			sendAnalytics(AnalyticsEventTypes.TrackEvent, {
				name: AnalyticsTrackEventsEnum.ConnectToOrgTrackEventName,
				source: !gitHubServerAppIdPk ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
				jiraHost: installation.jiraHost,
				withApiKey: gitHubServerAppIdPk ? await calculateWithApiKeyFlag(installation, gitHubServerAppIdPk) : false,
				success: false,
				gitHubProduct
			});

			log.error({ err, gitHubProduct }, "Error processing subscription add request");
			throw err;
		}
	};
