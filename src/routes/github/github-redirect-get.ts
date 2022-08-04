import { Request, Response } from "express";
import { titleForPage } from "routes/session/session-get";

export const GithubRedirectGet = async (
	req: Request,
	res: Response
): Promise<void> => {

	res.render("session.hbs", {
		titleForLoading: titleForPage(req)
	});
};
