import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { chain, groupBy } from "lodash";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { getAllKnownHeaders } from "utils/http-headers";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

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

			await sendScreenAnalytics({ jiraHost: res.locals.jiraHost, isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubServerListScreenEventName });
			res.render("jira-select-server.hbs", {
				list: servers,
				// Passing these query parameters for the route when clicking `Connect a new server`
				pathNameForAddNew: "github-server-url-page",
				queryStringForPathNew: JSON.stringify({ new: 1 })
			});
		} else {
			await sendScreenAnalytics({ jiraHost: res.locals.jiraHost, isNew, gheServers, name: AnalyticsScreenEventsEnum.SelectGitHubServerUrlScreenEventName });
			res.render("jira-server-url.hbs", {
				csrfToken: req.csrfToken(),
				installationId: res.locals.installation.id,
				knownHttpHeadersLowerCase: getAllKnownHeaders()
			});
		}

		req.log.debug("Jira Connect Enterprise GET page rendered successfully.");
	} catch (error: unknown) {
		return next(new Error(`Failed to render Jira Connect Enterprise GET page: ${errorStringFromUnknown(error)}`));
	}
};

const sendScreenAnalytics = async ({ jiraHost, isNew, gheServers, name }) => {
	await sendAnalytics(jiraHost, AnalyticsEventTypes.ScreenEvent, {
		name
	}, {
		createNew: isNew,
		existingServerAppsCount: gheServers?.length || 0
	});
};
