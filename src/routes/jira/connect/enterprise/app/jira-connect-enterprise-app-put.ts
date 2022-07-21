import { NextFunction, Request, Response } from "express";

export const JiraConnectEnterpriseAppPut = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App PUT request");

		// TODO: Add logic for updating apps

		req.log.debug("Jira Connect Enterprise App updated successfully.", res.locals);
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect Enterprise App PUT request: ${error}`));
	}
};
