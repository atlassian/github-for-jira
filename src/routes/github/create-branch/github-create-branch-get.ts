import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { getJiraClient } from "~/src/jira/client/jira-client";
import {
	replaceNonAlphaNumericWithHyphenHelper,
	replaceSpaceWithHyphenHelper
} from "utils/handlebars/handlebar-helpers";
import { createUserClient } from "utils/get-github-client-config";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];
const branches = [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

	enum IssueType { story = 10001, task = 10002, bug = 10003 }

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const { issue_key: key, issue_summary: summary } = req.query;
	if (!key) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}

	const branchSuffix = summary ? replaceSpaceWithHyphenHelper(replaceNonAlphaNumericWithHyphenHelper(summary as string)) : "";
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	const response = await gitHubUserClient.getUserRepositories();
	const jiraClient = await getJiraClient(jiraHost, 27732799, gitHubAppConfig.gitHubAppId);
	const jiraResponse = await jiraClient.issues.get(key, { fields: "issuetype" });
	const issueType = IssueType[jiraResponse.data.fields.issuetype.id];
	console.log("🚀 ~ file: github-create-branch-get.ts ~ line 25 ~ GithubCreateBranchGet ~ jiraResponse", jiraResponse.data.fields.issuetype.id);

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			type: issueType,
			branchName: `${key}-${branchSuffix}`,
			key
		},
		servers,
		repos: response.viewer.repositories.edges,
		branches
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};
