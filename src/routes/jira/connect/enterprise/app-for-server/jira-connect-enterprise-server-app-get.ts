import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

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

		const gheServers = await GitHubServerApp.getAllForGitHubBaseUrl(decodeURIComponent(baseUrl), res.locals.installation.id);

		if (!isNew && gheServers?.length) {
			// `identifier` is the githubAppName for the GH server app
			const serverApps = gheServers.map(server => ({ identifier: server.gitHubAppName }));

			res.render("jira-select-github-cloud-app.hbs", {
				list: serverApps
			});
		} else {
			res.render("jira-select-app-creation.hbs", {
				previousPagePath: "github-server-url-page"
			});
		}

		req.log.debug("Jira Connect Enterprise App page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise App page: ${error}`));
	}
};
