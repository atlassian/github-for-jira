import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { createAppClient } from "utils/get-github-client-config";

// TODO: need to update this later with actual data later on
const repos = [{ id: 1, name: "first-repo", org: "org-1" }, { id: 2, name: "second-repo", org: "org-1"  }, { id: 3, name: "third-repo", org: "org-2" }];
const branches = [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppId
	} = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId);
	const { data: info } = await gitHubAppClient.getApp();

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		title: "Create a Branch",
		gitHubAccount: info.owner.login,
		repos,
		branches
	});


	req.log.debug(`Github Create Branch Page rendered page`);
};
