import { NextFunction, Request, Response } from "express";
import { envVars } from "config/env";

export const JiraSelectVersionGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {

		req.log.info("Received Jira select page request");

		res.render("jira-select-github-version.hbs");

		req.log.info("Jira select rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira select version page: ${error}`));
	}
};
