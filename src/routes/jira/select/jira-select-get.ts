import { NextFunction, Request, Response } from "express";

export const JiraSelectGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {

		req.log.info("Received jira select page request");

		res.render("jira-select-github-version.hbs");

		req.log.info("Jira select rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira configuration: ${error}`));
	}
};
