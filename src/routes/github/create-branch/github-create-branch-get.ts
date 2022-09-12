import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { getJiraClient } from "~/src/jira/client/jira-client";
import {
	replaceNonAlphaNumericWithHyphenHelper,
	replaceSpaceWithHyphenHelper
} from "utils/handlebars/handlebar-helpers";
import { createUserClient } from "utils/get-github-client-config";
import { Subscription } from "~/src/models/subscription";

// TODO: need to update this later with actual data later on
const servers = [{ id: 1, server: "http://github.internal.atlassian.com", appName: "ghe-app" }, { id: 2, server: "http://github.external.atlassian.com", appName: "ghe-app-2" }];
const branches = [{ id: 1, name: "first-branch" }, { id: 2, name: "second-branch" }, { id: 3, name: "third-branch" }];


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

	const branchSuffix = summary ? replaceSpaceWithHyphenHelper(replaceNonAlphaNumericWithHyphenHelper(summary as string)) : "";
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	const response = await gitHubUserClient.getUserRepositories();

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			type: await getIssueType(jiraHost, key, gitHubAppConfig.gitHubAppId),
			branchName: `${key}-${branchSuffix}`,
			key
		},
		servers,
		repos: response.viewer.repositories.edges,
		branches
	});

	req.log.debug(`Github Create Branch Page rendered page`);
};


const getIssueType = async (jiraHost, key, gitHubAppId) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppId);
	if (subscriptions.length === 0) {
		throw new Error("No Subscription found");
	}
	const jiraClient = await getJiraClient(jiraHost, subscriptions[0].gitHubInstallationId, gitHubAppId);
	const jiraResponse = await jiraClient.issues.get(key, { fields: "issuetype" });
	return jiraResponse?.data?.fields?.issuetype?.name.toLowerCase();
};