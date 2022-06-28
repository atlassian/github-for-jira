import { NextFunction, Request, Response } from "express";

export const JiraAppCreationPost = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira app creation page request");

		res.render("jira-select-app-creation.hbs", {
			previousPagePath: "github-server-url-page"
		});

		req.log.info("Jira app creation page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira app creation page: ${error}`));
	}
};
