import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { createAppClient } from "utils/get-github-client-config";

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
		// TODO: update this with actual data later on
		repos: [{ id: 1, name: "first-repo", org: "org-1" }, { id: 2, name: "second-repo", org: "org-1"  }, { id: 3, name: "third-repo", org: "org-2" }],
		branches: [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }]
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
