import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraGheServerApps = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira GHE server apps page request");

		const { id: installationId } = res.locals.installation;
		const githubServerBaseUrl = req.query.serverUrl as string;

		if (!githubServerBaseUrl) {
			throw new Error("No server URL passed!");
		}

		const servers = await GitHubServerApp.getAllForGitHubBaseUrl(githubServerBaseUrl, installationId) || [];
		const serverApps = servers.map(server => ({ displayName: server.gitHubAppName }));

		if (serverApps.length) {
			res.render("jira-select-github-cloud-app.hbs", {
				servers: serverApps,
				previousPagePath: "github-list-servers-page"
			});
		} else {
			res.render("jira-select-app-creation.hbs", {
				previousPagePath: "github-list-servers-page"
			});
		}

		req.log.debug("Jira GHE server apps rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira GHE server apps page: ${error}`));
	}
};
