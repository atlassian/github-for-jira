import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { getJiraClient } from "~/src/jira/client/jira-client";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];
const repos = [{ id: 1, name: "sample", org: "Harminder84" }, { id: 2, name: "second-repo", org: "org-1"  }, { id: 3, name: "third-repo", org: "org-2" }];
const branches = [{ id: "branch-1", name: "branch-1" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken
	} = res.locals;

	enum IssueType { story = 10001, task = 10002, bug = 10003 }
	const { issue_key: key } = req.query;

	const jiraClient = await getJiraClient(
		jiraHost,
		27732799,
		res.locals.gitHubAppConfig.gitHubAppId
	);
	const jiraResponse = await jiraClient.issues.get("PROJECTA-19", { fields: "issuetype" });
	console.log("🚀 ~ file: github-create-branch-get.ts ~ line 25 ~ GithubCreateBranchGet ~ jiraResponse", jiraResponse.data.fields.issuetype.id);
	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			key,
			type: IssueType[jiraResponse.data.fields.issuetype.id]
		},
		servers,
		repos,
		branches
	});


	req.log.debug(`Github Create Branch Page rendered page`);
};
