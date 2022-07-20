import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { chain, groupBy } from "lodash";

export const JiraConnectEnterpriseGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const { id: installationId } = res.locals.installation;
		const isNew = req.query.new;
		req.log.debug("Received Jira Connect Enterprise get page request");

		const gheServers = await GitHubServerApp.findForInstallationId(installationId);

		if (!isNew && gheServers?.length) {
			const servers = chain(groupBy(gheServers, "gitHubBaseUrl")).map((_, key) => ({ displayName: key })).value();

			res.render("jira-select-server.hbs", {
				list: servers
			});
		} else {
			res.render("jira-server-url.hbs", {
				previousPagePath: "github-select-version-page",
				csrfToken: req.csrfToken(),
				installationId: res.locals.installation.id
			});
		}

		req.log.debug("Jira Connect Enterprise get page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise get page: ${error}`));
	}
};
