import { NextFunction, Request, Response } from "express";

export const JiraServerUrlGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira server url page request");

		res.render("jira-server-url.hbs", {
			previousPagePath: "github-select-product-page",
			csrfToken: req.csrfToken(),
			installationId: res.locals.installation.id
		});

		req.log.debug("Jira server url page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira server url page: ${error}`));
	}
};
