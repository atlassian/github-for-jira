import { GithubAPI } from "config/github-api";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { App } from "@octokit/app";

export const getGithubClientMiddleware = (octokitApp: App): RequestHandler => async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
	// If githubToken isn't set, this GithubAPI will be unauthed
	res.locals.github = GithubAPI();
	res.locals.client = GithubAPI({
		auth: octokitApp.getSignedJsonWebToken()
	});
	next();
};
