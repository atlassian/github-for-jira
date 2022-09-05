import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { createUserClient } from "utils/get-github-client-config";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];
const branches = [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppId
	} = res.locals;

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
	const response = await gitHubUserClient.getUserRepositories();

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		servers,
		repos: response.viewer.repositories.edges,
		branches
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
