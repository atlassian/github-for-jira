import { Request, Response, NextFunction } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";

export const JiraConnectEnterpriseAppPut = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	req.log.debug("Received Jira Connect Enterprise App PUT request to update app.");
	try {
		const { gitHubAppConfig: verifiedApp, jiraHost } = res.locals;

		if (!verifiedApp.gitHubAppId || verifiedApp.uuid !== req.body.uuid) {
			res.status(404).send({ message: "No GitHub App found. Cannot update." });
			return next(new Error("No GitHub App found for provided UUID and installationId."));
		}

		const updatedAppPayload = { ...req.body };
		if (!updatedAppPayload.privateKey) {
			updatedAppPayload.privateKey = undefined;
		}

		await GitHubServerApp.updateGitHubAppByUUID(req.body, jiraHost);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.UpdateGitHubServerAppTrackEventName,
			success: true
		});

		res.status(202).send();
		req.log.debug("Jira Connect Enterprise App updated successfully.");
	} catch (error) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.UpdateGitHubServerAppTrackEventName,
			success: false
		});

		res.status(404).send({ message: "Failed to update GitHub App." });
		return next(new Error(`Failed to update GitHub app: ${error}`));
	}
};
