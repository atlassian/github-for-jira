import { Request, Response } from "express";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const SessionGet = (req: Request, res: Response) => {
	if (req.query.resetSession) {
		const cookies = req.cookies;
		for (const cookieName in cookies) {
			res.clearCookie(cookieName);
		}
		delete req.query.resetSession;
	}

	const url = createUrlWithQueryString(req, req.params[0] || "");
	const title = configForPage(req);

	res.render("session.hbs", {
		redirectUrl: new URL(url, process.env.APP_URL).href,
		nonce: res.locals.nonce,
		title
	});
};

/**
 * This method returns the title for the session loading page,
 * Query parameter `ghRedirect` determines the text to be displayed on the loading screen
 */
export const configForPage = (req: Request): string => {
	switch (req.query.ghRedirect) {
		case "to":
			return "Redirecting to your GitHub Enterprise Server instance";
		case "from":
			return "Retrieving data from your GitHub Enterprise Server";
		default:
			return "Redirecting to GitHub Cloud";
	}
};
