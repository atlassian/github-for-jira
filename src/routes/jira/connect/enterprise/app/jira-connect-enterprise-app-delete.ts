import { Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { isConnected } from "utils/is-connected";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

export const JiraConnectEnterpriseAppDelete = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App DELETE request");

		const { gitHubAppConfig, jiraHost } = res.locals;
		if (!gitHubAppConfig || !gitHubAppConfig.uuid) {
			req.log.warn("Refuse to delete app due to GitHubServerApp not found");
			res.status(404).json({ message: "No GitHub App found. Cannot delete." });
			return;
		}

		await GitHubServerApp.uninstallApp(gitHubAppConfig.uuid);
		// TODO: Need to delete the corresponding subscription too - ARC-2440

		await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.DeleteGitHubServerAppTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.DeleteGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: true
		});

		if (!(await isConnected(jiraHost))) {
			await saveConfiguredAppProperties(jiraHost, req.log, false);
		}

		res.status(200).json({ success: true });
		req.log.debug("Jira Connect Enterprise App deleted successfully.");
	} catch (error: unknown) {

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.DeleteGitHubServerAppTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.DeleteGitHubServerAppTrackEventName,
			source: AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: false
		});

		req.log.error({ error }, "Failed to delete app due error");
		res.status(200).json({ success: false, message: "Failed to delete GitHub App." });
		return;
	}
};
