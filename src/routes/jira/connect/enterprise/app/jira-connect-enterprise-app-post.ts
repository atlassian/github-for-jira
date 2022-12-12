import { Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";

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
			privateKey
		} = req.body;

		await GitHubServerApp.install({
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId: installation.id
		}, jiraHost);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.CreateGitHubServerAppTrackEventName,
			success: true
		});

		res.status(202).send();

		req.log.debug("Jira Connect Enterprise App added successfully.");
	} catch (err) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.CreateGitHubServerAppTrackEventName,
			success: false
		});

		req.log.warn({ err }, "Could not create the app");
		res.status(500).send({ message: "Failed to create GitHub App." });
	}
};
