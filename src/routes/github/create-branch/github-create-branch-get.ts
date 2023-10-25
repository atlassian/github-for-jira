import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { createInstallationClient } from "utils/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { Repository, Subscription } from "models/subscription";
import Logger from "bunyan";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { RepoSyncState } from "models/reposyncstate";
const MAX_REPOS_RETURNED = 20;

export const GithubCreateBranchGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const gitHubAppConfig = res.locals.gitHubAppConfig;
	const jiraHost: string = res.locals.jiraHost;
	const logger = getLogger("github-create-branch-get", {
		fields: {
			...req.log?.fields,
			jiraHost
		}
	});

	if (!jiraHost) {
		logger.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return next();
	}

	const multiGHInstance = req.query.multiGHInstance;
	const issueKey = req.query.issueKey as string;
	const issueSummary = req.query.issueSummary as string;

	if (!issueKey) {
		logger.error(Errors.MISSING_ISSUE_KEY);
		res.status(400).send(Errors.MISSING_ISSUE_KEY);
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppConfig.gitHubAppId || null);

	// TODO move to middleware or shared for create-branch-options-get
	// Redirecting when the users are not configured (have no subscriptions)
	if (!subscriptions) {
		res.render("no-configuration.hbs", {
			nonce: res.locals.nonce,
			configurationUrl: `${jiraHost}/plugins/servlet/ac/${envVars.APP_KEY}/github-select-product-page`
		});

		await sendAnalytics(jiraHost, AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.NotConfiguredScreenEventName
		}, {
			jiraHost
		});
		return;
	}

	const repos = await getReposBySubscriptions(subscriptions, req.log, jiraHost);

	res.render("github-create-branch.hbs", {
		csrfToken: req.csrfToken(),
		jiraHost,
		nonce: res.locals.nonce,
		issue: {
			branchName: generateBranchName(issueKey, issueSummary),
			key: issueKey
		},
		issueUrl: `${jiraHost}/browse/${issueKey}`,
		repos,
		hostname: gitHubAppConfig.hostname,
		uuid: gitHubAppConfig.uuid,
		multiGHInstance
	});

	req.log.debug(`Github Create Branch Page rendered page`);

	await sendAnalytics(jiraHost, AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.CreateBranchScreenEventName
	}, {
		jiraHost
	});
};

export const generateBranchName = (issueKey: string, issueSummary: string) => {
	if (!issueSummary) {
		return issueKey;
	}

	let branchSuffix = issueSummary;
	const validBranchCharactersRegex = /[^a-z\d.\-_]/gi;
	const validStartCharactersRegex = /^[^a-z\d]/gi;
	const validEndCharactersRegex = /[^a-z\d]$/gi;
	branchSuffix = branchSuffix.replace(validStartCharactersRegex, "");
	branchSuffix = branchSuffix.replace(validEndCharactersRegex, "");
	branchSuffix = branchSuffix.replace(validBranchCharactersRegex, "-");
	branchSuffix = reduceRepeatingDashes(branchSuffix);
	return `${issueKey}-${branchSuffix}`;
};

const reduceRepeatingDashes = (text: string) => {
	const repeatingDashesRegex = /(-)\1{1,}/gi;
	const match = text.match(repeatingDashesRegex);
	if (match) {
		text = text.replace(repeatingDashesRegex, "-");
		return reduceRepeatingDashes(text);
	}
	return text;
};

const sortByDateString = (a, b) => {
	return new Date(b.node.updated_at).valueOf() - new Date(a.node.updated_at).valueOf();
};

const getReposBySubscriptions = async (subscriptions: Subscription[], logger: Logger, jiraHost: string): Promise<Repository[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		try {
			const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-create-branch" }, logger, subscription.gitHubAppId);
			const response = await gitHubInstallationClient.getRepositoriesPage(100, undefined, "UPDATED_AT");
			// The app can be installed in a GitHub org but that org might not be connected to Jira, therefore we must filter them out, or
			// the next steps (e.g. get repo branches to branch of) will fail
			const repoOwners = await RepoSyncState.findAllRepoOwners(subscription);
			const filteredRepos =  response.viewer.repositories.edges.filter(edge => repoOwners.has(edge.node.owner.login));
			return filteredRepos.slice(0, MAX_REPOS_RETURNED);
		} catch (err: unknown) {
			logger.error({ err }, "Create branch - Failed to fetch repos for installation");
			throw err;
		}
	});

	const repos = (await Promise.all(repoTasks))
		.flat()
		.sort(sortByDateString)
		.map(repo => repo.node);

	return repos.slice(0, MAX_REPOS_RETURNED);
};
