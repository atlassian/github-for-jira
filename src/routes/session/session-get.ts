import { Request, Response } from "express";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const SessionGet = (req: Request, res: Response) => {
	const url = createUrlWithQueryString(req, req.params[0] || "");
	const { title, loadAutoAppCreation } = configForPage(req);

	res.render("session.hbs", {
		redirectUrl: new URL(url, process.env.APP_URL).href,
		nonce: res.locals.nonce,
		title,
		loadAutoAppCreation
	});
};

/**
 * This method returns the title for the session loading page,
 * Query parameter `ghRedirect` determines the text to be displayed on the loading screen
 * Query parameter `autoApp` determines whether to load the auto app creation script `github-redirect.js`
 * or the page refreshing script
 */
export const configForPage = (req: Request) => {
	let title = "";

	switch (req.query?.ghRedirect) {
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

	return {
		loadAutoAppCreation: req.query?.autoApp,
		title
	};
};