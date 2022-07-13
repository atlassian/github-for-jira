import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraGheServers = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira GHE servers page request");

		const servers = await GitHubServerApp.findForInstallationId(res.locals.installation.id) || [];

		res.render("jira-select-server.hbs", {
			servers
		});

		req.log.debug("Jira GHE servers rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira GHE servers page: ${error}`));
	}
};
