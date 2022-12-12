import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";

export const JiraConnectEnterpriseDelete = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise Server DELETE request");

		const { installation }  = res.locals;

		await GitHubServerApp.uninstallServer(req.body.serverUrl, installation.id);

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: true
		});

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise Server successfully deleted.");
	} catch (error) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise,
			success: false
		});

		res.status(200).send({ success: false, message: "Failed to delete GitHub Enterprise Server." });
		return next(new Error(`Failed to DELETE GitHub Enterprise Server: ${error}`));
	}
};
