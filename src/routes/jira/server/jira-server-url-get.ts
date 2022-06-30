import { NextFunction, Request, Response } from "express";

export const JiraServerUrlGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira server url page request");

		res.render("jira-server-url.hbs", {
			previousPagePath: "github-select-version-page",
			csrfToken: req.csrfToken()
		});

		req.log.info("Jira server url page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira server url page: ${error}`));
	}
};
