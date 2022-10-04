import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import {
	replaceSpaceWithHyphenHelper
} from "utils/handlebars/handlebar-helpers";
import { createUserClient } from "utils/get-github-client-config";

export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const { issue_key: key, issue_summary: summary } = req.query;
	if (!key) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}

	const branchSuffix = summary ? replaceSpaceWithHyphenHelper(summary as string) : "";

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	const response = await gitHubUserClient.getUserRepositories();
	const gitHubUser = (await gitHubUserClient.getUser()).data.login;

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: `${key}-${branchSuffix}`,
			key
		},
		repos: response.viewer.repositories.edges,
		gitHubUser
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
