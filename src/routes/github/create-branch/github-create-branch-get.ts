import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";

export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken
	} = res.locals;

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}


	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		title: "Create a Branch"
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
