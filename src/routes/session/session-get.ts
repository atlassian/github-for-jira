import { NextFunction, Request, Response } from "express";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const SessionGet = (req: Request, res: Response, next: NextFunction) => {
	if (!req.params[0]) {
		return next(new Error("Missing redirect url for session.  Needs to be in format `/session/:redirectUrl`"));
	}

	const url = createUrlWithQueryString(req, req.params[0]);

	return res.render("session.hbs", {
		title: "Logging you into GitHub",
		APP_URL: process.env.APP_URL,
		redirectUrl: new URL(url, process.env.APP_URL).href,
		nonce: res.locals.nonce
	});
};

