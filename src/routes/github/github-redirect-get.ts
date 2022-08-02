import { Request, Response } from "express";

export const GithubRedirectGet = async (
	req: Request,
	res: Response
): Promise<void> => {

	res.render("jira-redirect.hbs", {
		title: "Redirecting",
		baseUrl: req.query?.baseUrl
	});
};
