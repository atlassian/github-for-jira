import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "~/src/models/subscription";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { getLogger } from "config/logger";
import { envVars } from "config/env";

// TODO - this entire route could be abstracted out into a generic get instance route on github/instance
export const GithubCreateBranchOptionsGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const { issueKey, jwt } = req.query;
	const logger = getLogger("github-create-branch-options-get", {
		fields: req.log?.fields
	});

	console.log("START");
	if (!res.locals.jiraHost) {
		logger.warn({ req, res }, Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return next();
	}

	console.log("START2");
	if (!issueKey) {
		return next(new Error(Errors.MISSING_ISSUE_KEY));
	}

	const jiraHost = res.locals.jiraHost;

	console.log("START3 - jiraHost");
	console.log("START4");
	// TODO move to middleware or shared for create-branch-get
	const servers = await getGitHubServers(jiraHost);

	if (!servers.hasCloudServer && !servers.gheServerInfos.length) {
		console.log("START - redirect");
		res.render("no-configuration.hbs", {
			nonce: res.locals.nonce,
			configurationUrl: `${jiraHost}/plugins/servlet/ac/${envVars.APP_KEY}/github-select-product-page`
		});

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.NotConfiguredScreenEventName,
			jiraHost
		});

		return;
	}
	console.log("START5");

	const url = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
	const encodedJiraHost = encodeURIComponent(jiraHost);
	// Only has cloud instance
	if (servers.hasCloudServer && servers.gheServerInfos.length == 0) {
		res.redirect(`/github/create-branch${url.search}&jiraHost=${encodedJiraHost}`);
		return;
	}
	// Only single GitHub Enterprise connected
	if (!servers.hasCloudServer && servers.gheServerInfos.length == 1) {
		res.redirect(`/github/${servers.gheServerInfos[0].uuid}/create-branch${url.search}&jiraHost=${encodedJiraHost}`);
		return;
	}

	res.render("github-create-branch-options.hbs", {
		nonce: res.locals.nonce,
		jiraHost,
		jwt,
		servers
	});

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.CreateBranchOptionsScreenEventName,
		jiraHost
	});
};

const getGitHubServers = async (jiraHost: string) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const ghCloudSubscriptions = subscriptions.filter(subscription => !subscription.gitHubAppId);
	const gheServerSubscriptions = subscriptions.filter(subscription => subscription.gitHubAppId);
	const uniqueGithubAppIds = new Set(gheServerSubscriptions.map(gheServerSubscription => gheServerSubscription.gitHubAppId));

	const gheServerInfos = new Array<{ uuid: string, baseUrl: string, appName: string }>();
	for (const gitHubAppId of uniqueGithubAppIds) {
		if (gitHubAppId) {
			const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
			if (gitHubServerApp) {
				gheServerInfos.push({
					"uuid": gitHubServerApp.uuid,
					"baseUrl": gitHubServerApp.gitHubBaseUrl,
					"appName": gitHubServerApp.gitHubAppName
				});
			}
		}
	}

	return {
		hasCloudServer: ghCloudSubscriptions.length,
		gheServerInfos
	};
};


