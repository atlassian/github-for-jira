import { Request, Response, NextFunction } from "express";

export const GitHubTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
	const token = req.headers["github-auth"];

	if (!token) {
		res.status(401).send("No github token passed!");
		return;
	}

	try {
		res.locals.githubToken = token;
		next();
	} catch (e) {
		req.log.warn({ err: e }, "No Github token");
		res.status(401).send("No github token passed");
		return;
	}

};
