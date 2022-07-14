import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraManualAppCreationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira app creation page request");

		const gitHubServerAppId = req.query.ghsaId as string;
		const app = await GitHubServerApp.getForGitHubServerAppId(parseInt(gitHubServerAppId));

		res.render("jira-manual-app-creation.hbs", {
			previousPagePath: "github-app-creation-page",
			app
		});

		req.log.debug("Jira manual app creation page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira app creation page: ${error}`));
	}
};