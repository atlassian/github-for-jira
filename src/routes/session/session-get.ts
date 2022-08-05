import { Request, Response } from "express";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const SessionGet = (req: Request, res: Response) => {
	if (!req.params[0]) {
		res.status(400).send("Missing redirect url for session cloud. Needs to be in format `/session/:redirectUrl`");
		return;
	}
	const url = createUrlWithQueryString(req, req.params[0]);

	res.render("session.hbs", {
		APP_URL: process.env.APP_URL,
		redirectUrl: new URL(url, process.env.APP_URL).href,
		nonce: res.locals.nonce,
		titleForLoading: titleForPage(req)
	});
};

/**
 * This method returns the title for the session loading page,
 * based upon the query parameters `ghRedirect`
 */
export const titleForPage = (req: Request) => {
	let title;
	const redirect = req.query?.ghRedirect ?? null;

	switch (redirect) {
		case "to":
			title = "Redirecting to your GitHub Enterprise Server instance";
			break;
		case "from":
			title = "Retrieving data from your GitHub Enterprise Server";
			break;
		default:
			title = "Redirecting to GitHub Cloud";
			break;
	}

	return title;
};