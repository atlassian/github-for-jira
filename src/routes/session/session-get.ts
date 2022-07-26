import { NextFunction, Request, Response } from "express";

export const SessionGet = (req: Request, res: Response, next: NextFunction) => {
	if (!req.params[0]) {
		return next(new Error("Missing redirect url for session. Needs to be in format `/session/:redirectUrl`"));
	}

	res.render("session.hbs", {
		title: "Logging you into GitHub",
		APP_URL: process.env.APP_URL,
		redirectUrl: new URL(req.params[0], process.env.APP_URL).href,
		nonce: res.locals.nonce
	});
};

export const SessionEnterpriseGet = (req: Request, res: Response, next: NextFunction) => {
	if (!req.params[0]) {
		return next(new Error("Missing redirect url for session enterprise. Needs to be in format `/session/enterprise/:redirectUrl`"));
	}

	res.render("gitHub-loading.hbs", {
		APP_URL: process.env.APP_URL,
		redirectUrl: new URL(req.params[0], process.env.APP_URL).href,
		nonce: res.locals.nonce,
		isGitHubCloud: false
	});
};

export const SessionCloudGet = (req: Request, res: Response, next: NextFunction) => {
	if (!req.params[0]) {
		return next(new Error("Missing redirect url for session cloud. Needs to be in format `/session/cloud/:redirectUrl`"));
	}

	res.render("gitHub-loading.hbs", {
		APP_URL: process.env.APP_URL,
		redirectUrl: new URL(req.params[0], process.env.APP_URL).href,
		nonce: res.locals.nonce,
		isGitHubCloud: true
	});
};