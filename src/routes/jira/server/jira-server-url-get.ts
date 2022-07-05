import { NextFunction, Request, Response } from "express";

export const JiraServerUrlGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira server url page request");

		res.render("jira-manual-app-creation.hbs", {
			previousPagePath: "github-select-version-page",
			githubBaseUrl: "https://kmaharjan4.atlassian.net/",
			uuid: "UUID-TEST-FOR-GH4J"
		});

		req.log.debug("Jira server url page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira server url page: ${error}`));
	}
};
