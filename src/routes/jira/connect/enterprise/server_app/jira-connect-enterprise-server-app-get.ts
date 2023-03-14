import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const JiraConnectEnterpriseServerAppGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App page request");

		const baseUrl = req.params.serverUrl as string;
		const isNew = req.query.new;

		if (!baseUrl) {
			throw new Error("No server URL passed!");
		}

		const gheServers = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(decodeURIComponent(baseUrl), res.locals.installation.id);

		if (!isNew && gheServers?.length) {
			// `identifier` is the githubAppName for the GH server app
			const serverApps = gheServers.map(server => ({ identifier: server.gitHubAppName, uuid: server.uuid }));

			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubAppsListScreenEventName });
			res.render("jira-select-github-cloud-app.hbs", {
				list: serverApps,
				// Passing these query parameters for the route when clicking `Create new application`
				queryStringForPath: JSON.stringify({ new: 1, serverUrl: baseUrl }),
				serverUrl: baseUrl
			});
		} else {
			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubAppsCreationScreenEventName });
			req.session.temp = { gheHost: baseUrl };
			res.render("jira-select-app-creation.hbs", { baseUrl });
		}

		req.log.debug("Jira Connect Enterprise App page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise App page: ${error}`));
	}
};

const sendScreenAnalytics = ({ isNew, gheServers, name }) => {
	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name,
		createNew: isNew,
		existingServerAppsCount: gheServers?.length || 0
	});
};
