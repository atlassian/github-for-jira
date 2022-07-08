import { NextFunction, Request, Response } from "express";

export const JiraManualAppCreationGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira app creation page request");

		// TODO: add data
		res.render("jira-manual-app-creation.hbs", {
			previousPagePath: "github-server-url-page",
			gitHubBaseUrl: "",
			uuid: ""
		});

		req.log.debug("Jira manual app creation page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira app creation page: ${error}`));
	}
};
