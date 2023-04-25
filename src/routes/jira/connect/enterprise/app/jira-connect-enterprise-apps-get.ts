import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { resolveIntoConnectConfig } from "utils/ghe-connect-config-temp-storage";

export const JiraConnectEnterpriseAppsGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App page request");

		const tempConnectConfigUuidOrServerUuid = req.params.tempConnectConfigUuidOrServerUuid as string;
		const isNew = req.query.new;
		const installationId = res.locals.installation.id;

		const connectConfig = await resolveIntoConnectConfig(tempConnectConfigUuidOrServerUuid, installationId);

		if (!connectConfig) {
			req.log.warn({ tempConnectConfigUuidOrServerUuid }, "No server config found!");
			res.sendStatus(404);
			return;
		}

		const baseUrl = connectConfig.serverUrl;

		const gheServers = await GitHubServerApp.getAllForGitHubBaseUrlAndInstallationId(decodeURIComponent(baseUrl), installationId);

		if (!isNew && gheServers?.length) {
			// `identifier` is the githubAppName for the GH server app
			const serverApps = gheServers.map(server => ({ identifier: server.gitHubAppName, uuid: server.uuid }));

			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubAppsListScreenEventName });
			res.render("jira-select-server-app.hbs", {
				list: serverApps,
				pathNameForAddNew: "github-app-creation-page", // lol, this actually references the same endpoint, but with new flag :mindpop:
				queryStringForPathNew: JSON.stringify({
					new: 1,
					connectConfigUuid: tempConnectConfigUuidOrServerUuid,
					serverUrl: tempConnectConfigUuidOrServerUuid // TODO: remove when the descriptor is propagated everywhere, in 1 month maybe?
				}),
				serverUrl: baseUrl
			});
		} else {
			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubAppsCreationScreenEventName });
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
