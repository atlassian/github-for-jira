import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { replaceSpaceWithHyphenHelper } from "utils/handlebars/handlebar-helpers";
import { createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { Subscription } from "models/subscription";
import Logger from "bunyan";
import { RepositoryNode } from "~/src/github/client/github-queries";
const MAX_REPOS_RETURNED = 20;

export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const { issueKey, issueSummary } = req.query;
	if (!issueKey) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);

	// TODO - this should redirect to a you are not configured page instead.
	if (!subscriptions) {
		return next(new Error(Errors.MISSING_CONFIGURAITON));
	}

	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log('jiraHost');
	console.log(jiraHost);

	const branchSuffix = issueSummary ? replaceSpaceWithHyphenHelper(issueSummary as string) : "";
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	const gitHubUser = (await gitHubUserClient.getUser()).data.login;
	const repos = await getReposBySubscriptions(subscriptions, req.log, jiraHost, gitHubAppConfig.gitHubAppId);

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: `${issueKey}-${branchSuffix}`,
			key: issueKey
		},
		repos,
		uuid: gitHubAppConfig.uuid,
		gitHubUser
	});

	req.log.debug(`Github Create Branch Page rendered page`);

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.CreateBranchScreenEventName,
		jiraHost
	});
};

const sortByDateString = (a, b) => {
	return new Date(b.node.updated_at).valueOf() - new Date(a.node.updated_at).valueOf();
};

const getReposBySubscriptions = async (subscriptions: Subscription[], logger: Logger, jiraHost: string, gitHubAppId?: number): Promise<RepositoryNode[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		try {
			const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, logger, gitHubAppId);
			const response = await gitHubInstallationClient.getRepositoriesPage(MAX_REPOS_RETURNED, undefined,  "UPDATED_AT");
			return response.viewer.repositories.edges;
		} catch (err) {
			logger.error("Create branch - Failed to fetch repos for installation");
			throw err;
		}
	});

	const repos = (await Promise.all(repoTasks))
		.flat()
		.sort(sortByDateString);

	return repos.slice(0, MAX_REPOS_RETURNED);
};
