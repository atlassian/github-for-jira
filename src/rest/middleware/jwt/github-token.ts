import { Request, Response, NextFunction } from "express";
import { errorWrapper } from "../../helper";
import { InvalidTokenError } from "config/errors";

export const GitHubTokenHandler = errorWrapper("GitHubTokenHandler", (req: Request, res: Response, next: NextFunction) => {
	const token = req.headers["github-auth"];

	if (!token) {
		throw new InvalidTokenError("Github token invalid");
	}

	res.locals.githubToken = token;
	next();
	return Promise.resolve();
});
