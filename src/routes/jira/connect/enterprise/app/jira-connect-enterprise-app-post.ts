import { Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

export const JiraConnectEnterpriseAppPost = async (
	req: Request,
	res: Response
): Promise<void> => {

	const { installation, jiraHost } = res.locals;

	try {
		req.log.debug("Received Jira Connect Enterprise App POST request");

		const {
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			apiKeyHeaderName,
			apiKeyValue
		} = req.body;

		const existing = await GitHubServerApp.findForUuid(uuid);
		if (existing && existing.installationId != installation.id) {
			req.log.warn({ gheServerAppUuid: uuid }, "Collision with some other customer, shouldn't happen");
			res.sendStatus(400);
			return;
		}

		await GitHubServerApp.install({
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId: installation.id,
			apiKeyHeaderName,
			encryptedApiKeyValue: apiKeyValue ? await GitHubServerApp.encrypt(installation.jiraHost, apiKeyValue) : null
		}, jiraHost);

		await new GheConnectConfigTempStorage().delete(uuid, installation.id);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.CreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: true
		});

		res.status(202).send();

		req.log.debug("Jira Connect Enterprise App added successfully.");
	} catch (err) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.CreateGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: false
		});

		req.log.warn({ err }, "Could not create the app");
		res.status(500).send({ message: "Failed to create GitHub App." });
	}
};
