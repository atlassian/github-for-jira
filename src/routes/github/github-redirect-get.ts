import { Request, Response } from "express";

export const GithubRedirectGet = async (
	_req: Request,
	res: Response
): Promise<void> => {

	res.render("jira-redirect.hbs", {
		title: "Redirecting"
	});
};
