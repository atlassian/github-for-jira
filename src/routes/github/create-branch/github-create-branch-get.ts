import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import {
	replaceSpaceWithHyphenHelper
} from "utils/handlebars/handlebar-helpers";
import { createUserClient } from "utils/get-github-client-config";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];

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

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: `${key}-${branchSuffix}`,
			key
		},
		servers,
		repos: response.viewer.repositories.edges
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
