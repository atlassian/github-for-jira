import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraEditAppGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira edit app page request");

		const gitHubServerAppId = req.params.id as string;
		const app = await GitHubServerApp.getForGitHubServerAppId(parseInt(gitHubServerAppId));

		res.render("jira-manual-app-creation.hbs", {
			previousPagePath: "github-app-creation-page",
			app
		});

		req.log.debug("Jira edit app page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira edit app page: ${error}`));
	}
};