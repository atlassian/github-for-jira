import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { groupBy, chain } from "lodash";

export const JiraGheServers = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira GHE servers page request");

		const allServers = await GitHubServerApp.findForInstallationId(res.locals.installation.id) || [];
		const gheServers = chain(groupBy(allServers, "gitHubBaseUrl")).map((_, key) => ({ displayName: key })).value();

		res.render("jira-select-server.hbs", {
			servers: gheServers
		});

		req.log.debug("Jira GHE servers rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira GHE servers page: ${error}`));
	}
};
