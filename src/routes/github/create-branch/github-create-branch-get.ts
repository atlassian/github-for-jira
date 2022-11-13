import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { replaceSpaceWithHyphenHelper } from "utils/handlebars/handlebar-helpers";
import { createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { Subscription } from "models/subscription";
import Logger from "bunyan";
import { RepositoryNode } from "~/src/github/client/github-queries";
// import { GitHubUserClient } from "~/src/github/client/github-user-client";
const MAX_REPOS_RETURNED = 20;


export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		githubToken,
		gitHubAppConfig
	} = res.locals;
	const jiraHost = req.query?.jiraHost as string;

	// TODO WE NEED TO VALIDATE THE JIRAHOST !!
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
	const installationRepos = await getReposBySubscriptions(subscriptions, req.log, jiraHost);
	const userRepoResponse = await gitHubUserClient.getUserRepositoriesPage();

	// TODO JK - order userrepos by updated at
	// TODO JK  - change interscetion code to inspect new rest object and compare IDS on match keep installation version


	// TODO BREAK THIS LOGIC UP SO IT SPERATER LOGICALLY YO
	const getRepos = (installationRepos, userRepoResponse) => {
		const intersection = [];
		installationRepos.forEach((a: any) => {
			userRepoResponse.forEach((b) => {
				if (JSON.stringify((a.node.id)) === JSON.stringify((b.id))) {
					// intersection.push(a);
				}
			});
		});
		return intersection;
	};
	// const repos = intersectionWith([...installationRepos, ...userRepoResponse.viewer.repositories.edges], compareRepos);
	const repos = getRepos(installationRepos, userRepoResponse.data);

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
//
// const getReposByUser = async (gitHubUserClient: GitHubUserClient, logger: Logger): Promise<RepositoryNode[]> => {
// 	try {
// 		const response = gitHubUserClient.getUserRepositories(MAX_REPOS_RETURNED);// TODO ORDER BY UPDATED AT
// 		return response.repositories.edges;
// 	} catch (err) {
// 		logger.error("Create branch - Failed to fetch repos for installation");
// 		throw err;
// 	}
// };
