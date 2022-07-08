import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraManualAppCreationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira manual app creation page request");

		const gitHubServerAppId = req.query?.gitHubServerAppId as string;
		if (!gitHubServerAppId) {
			throw new Error("Github Server App id is not provided");
		}
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(parseInt(gitHubServerAppId));

		if (!gitHubServerAppId) {
			throw new Error("Github Server App id is invalid");
		}

		res.render("jira-manual-app-creation.hbs", {
			gitHubBaseUrl: gitHubServerApp?.gitHubBaseUrl,
			uuid: gitHubServerApp?.uuid
		});
		req.log.debug("Jira manual app creation page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira manual app creation page: ${error}`));
	}
};
