import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { replaceSpaceWithHyphenHelper } from "utils/handlebars/handlebar-helpers";
import { createUserClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { Subscription } from "models/subscription";
import { searchInstallationAndUserRepos } from "routes/github/repository/github-repository-get";

export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		githubToken,
		gitHubAppConfig
	} = res.locals;
	const jiraHost = req.query?.jiraHost as string;

	if (!githubToken) {
		req.log.warn(Errors.MISSING_GITHUB_TOKEN);
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	if (!jiraHost) {
		req.log.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return next();
	}

	const { issueKey, issueSummary } = req.query;
	if (!issueKey) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppConfig.gitHubAppId || null);

	// TODO move to middleware or shared for create-branch-options-get
	// Redirecting when the users are not configured (have no subscriptions)
	if (!subscriptions) {
		const instance = process.env.INSTANCE_NAME;
		res.render("no-configuration.hbs", {
			nonce: res.locals.nonce,
			configurationUrl: `${jiraHost}/plugins/servlet/ac/com.github.integration.${instance}/github-select-product-page`
		});

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.NotConfiguredScreenEventName,
			jiraHost
		});
		return;
	}

	const branchSuffix = issueSummary ? replaceSpaceWithHyphenHelper(issueSummary as string) : "";
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	const gitHubUser = (await gitHubUserClient.getUser()).data.login;

	const repos = await searchInstallationAndUserRepos("", jiraHost, gitHubAppConfig.gitHubAppId || null, githubToken, req.log);

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: `${issueKey}-${branchSuffix}`,
			key: issueKey
		},
		issueUrl: `${jiraHost}/browse/${issueKey}`,
		repos,
		hostname: gitHubAppConfig.hostname,
		uuid: gitHubAppConfig.uuid,
		gitHubUser
	});

	req.log.debug(`Github Create Branch Page rendered page`);

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.CreateBranchScreenEventName,
		jiraHost
	});
};
