import { NextFunction, Request, Response } from "express";

export const JiraConnectEnterpriseAppDelete = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App Delete page request");

		// TODO: Add logic for deleting apps

		req.log.debug("Jira Connect Enterprise App Delete page rendered successfully.", res.locals);
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise App Delete page: ${error}`));
	}
};
