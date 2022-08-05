import { Request, Response } from "express";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const SessionGet = (req: Request, res: Response) => {
	const url = createUrlWithQueryString(req, req.params[0] || "");
	const { title, appCreation } = configForPage(req);

	res.render("session.hbs", {
		redirectUrl: new URL(url, process.env.APP_URL).href,
		nonce: res.locals.nonce,
		title,
		appCreation
	});
};

/**
 * This method returns the title for the session loading page,
 * based upon the query parameters `ghRedirect`
 */
export const configForPage = (req: Request) => {
	const config = {
		title: "",
		appCreation: false
	};
	const redirect = req.query?.ghRedirect ?? null;

	switch (redirect) {
		case "to":
			config.title = "Redirecting to your GitHub Enterprise Server instance";
			config.appCreation = true;
			break;
		case "from":
			config.title = "Retrieving data from your GitHub Enterprise Server";
			break;
		default:
			config.title = "Redirecting to GitHub Cloud";
			break;
	}

	return config;
};