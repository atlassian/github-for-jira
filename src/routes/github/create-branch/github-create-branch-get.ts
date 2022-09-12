import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import {
	replaceNonAlphaNumericWithHyphenHelper,
	replaceSpaceWithHyphenHelper
} from "utils/handlebars/handlebar-helpers";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];
const repos = [{ id: 1, name: "first-repo", org: "org-1" }, { id: 2, name: "second-repo", org: "org-1"  }, { id: 3, name: "third-repo", org: "org-2" }];
const branches = [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken
	} = res.locals;

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const { issue_key: key, issue_summary: summary } = req.query;
	if (!key) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}

	const branchSuffix = summary ? replaceSpaceWithHyphenHelper(replaceNonAlphaNumericWithHyphenHelper(summary as string)) : "";

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: `${key}-${branchSuffix}`,
			key
		},
		servers,
		repos,
		branches
	});


	req.log.debug(`Github Create Branch Page rendered page`);
};
