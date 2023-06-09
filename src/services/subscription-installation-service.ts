import { createAppClient, createUserClient } from "utils/get-github-client-config";
import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import Logger from "bunyan";
import { Installation } from "models/installation";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { GitHubServerApp } from "models/github-server-app";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

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
		log.debug("Received add subscription request");

		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubServerAppIdPk);

		try {
			const metrics = {
				trigger: "github-configuration-post"
			};
			const gitHubUserClient = await createUserClient(githubToken, installation.jiraHost, metrics, log, gitHubServerAppIdPk);
			const gitHubAppClient = await createAppClient(log, installation.jiraHost, gitHubServerAppIdPk, metrics);

			// Check if the user that posted this has access to the installation ID they're requesting
			if (!await hasAdminAccess(gitHubAppClient, gitHubUserClient, gitHubInstallationId, log)) {
				log.warn(`Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation`);
				return {
					error: "`User is not an admin of the installation"
				};
			}

			const subscription: Subscription = await Subscription.install({
				hashedClientKey: installation.clientKey,
				installationId: gitHubInstallationId,
				host: installation.jiraHost,
				gitHubAppId: gitHubServerAppIdPk
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
