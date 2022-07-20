import { NextFunction, Request, Response } from "express";

export const JiraConnectGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira Connect page request");

		res.render("jira-select-github-version.hbs", {
			previousPagePath: "github-post-install-page"
		});

		req.log.info("Jira Connect page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect page: ${error}`));
	}
};