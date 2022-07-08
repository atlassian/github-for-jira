import { NextFunction, Request, Response } from "express";

export const JiraManualAppCreationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira manual app creation page request");

		// TODO: Need to fetch the newly created GH server and use its id to fetch the following data
		res.render("jira-manual-app-creation.hbs", {
			gitHubBaseUrl: "",
			uuid: ""
		});

		req.log.debug("Jira manual app creation page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira manual app creation page: ${error}`));
	}
};
