import { NextFunction, Request, Response } from "express";

export const JiraSelectProductGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira select GitHub product page request");

		res.render("jira-select-github-product.hbs", {
			previousPagePath: "github-post-install-page"
		});

		req.log.info("Jira select GitHub product page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira select GitHub product page: ${error}`));
	}
};
