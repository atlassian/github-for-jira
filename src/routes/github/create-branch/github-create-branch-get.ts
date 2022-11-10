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

type ResponseType =  Response<
	string,
	JiraHostVerifiedLocals
	& GitHubAppVerifiedLocals
	& GitHubUserTokenVerifiedLocals
>;
export const GithubCreateBranchGet = async (req: Request, res: ResponseType, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

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

	//TODO  ARC-1823: fix potential subscript get all for host bug
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppConfig.gitHubAppId as any || null);

	// Redirecting when the users are not configured (have no subscriptions)
	if (!subscriptions) {
		res.render("no-configuration.hbs", {
			nonce: res.locals.nonce
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
	const repos = await getReposBySubscriptions(subscriptions, req.log, jiraHost);

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
		hostname: gitHubAppConfig.gitHubBaseUrl,
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

const getReposBySubscriptions = async (subscriptions: Subscription[], logger: Logger, jiraHost: string): Promise<RepositoryNode[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		try {
			const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, logger, subscription.gitHubAppId);
			const response = await gitHubInstallationClient.getRepositoriesPage(MAX_REPOS_RETURNED, undefined, "UPDATED_AT");
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
