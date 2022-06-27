import { NextFunction, Request, Response } from "express";

export const JiraSelectVersionGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira select GitHub version page request");

		res.render("jira-select-github-version.hbs");

		req.log.info("Jira select rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira select GitHub version page: ${error}`));
	}
};
