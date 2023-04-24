import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { chain, groupBy } from "lodash";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const JiraConnectEnterpriseGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const { id: installationId } = res.locals.installation;
		const isNew = req.query?.new;
		req.log.debug("Received Jira Connect Enterprise GET page request");

		const gheServers = await GitHubServerApp.findForInstallationId(installationId);

		if (!isNew && gheServers?.length) {
			const servers = chain(groupBy(gheServers, "gitHubBaseUrl")).map((servers, key) => ({
				identifier: key,
				uuid: servers[0].uuid
			})).value();

			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubServerListScreenEventName });
			res.render("jira-select-server.hbs", {
				list: servers,
				// Passing these query parameters for the route when clicking `Connect a new server`
				pathNameForAddNew: "github-server-url-page",
				queryStringForPathNew: JSON.stringify({ new: 1 })
			});
		} else {
			sendScreenAnalytics({ isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubServerUrlScreenEventName });
			res.render("jira-server-url.hbs", {
				csrfToken: req.csrfToken(),
				installationId: res.locals.installation.id
			});
		}

		req.log.debug("Jira Connect Enterprise GET page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise GET page: ${error}`));
	}
};

const sendScreenAnalytics = ({ isNew, gheServers, name }) => {
	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name,
		createNew: isNew,
		existingServerAppsCount: gheServers?.length || 0
	});
};
