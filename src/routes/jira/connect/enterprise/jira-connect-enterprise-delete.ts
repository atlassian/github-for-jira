import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { isConnected } from "utils/is-connected";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

export const JiraConnectEnterpriseDelete = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise Server DELETE request");

		const { installation, jiraHost }  = res.locals;

		await GitHubServerApp.uninstallServer(req.body.serverUrl, installation.id);
		// TODO: Need to delete the corresponding subscription too - ARC-2440

		await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: true
		});

		if (!(await isConnected(jiraHost))) {
			await saveConfiguredAppProperties(jiraHost, req.log, false);
		}

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise Server successfully deleted.");
	} catch (error: unknown) {

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.RemoveGitHubServerTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: false
		});

		res.status(200).send({ success: false, message: "Failed to delete GitHub Enterprise Server." });
		next(new Error(`Failed to DELETE GitHub Enterprise Server: ${errorStringFromUnknown(error)}`)); return;
	}
};
