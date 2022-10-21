import { NextFunction, Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const GithubInstanceGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const { jiraHost: jiraHostLocal } = res.locals;
	const { tenantUrl, redirectPath } = req.query;

	if (!jiraHostLocal && !tenantUrl) {
		req.log.warn({ req, res }, Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return next();
	}

	const jiraHost = jiraHostLocal || getJiraHostFromTenantUrl(tenantUrl);

	const servers = await getGitHubServers(jiraHost);
	if (!servers.hasCloudServer && !servers.gheServerInfos.length) {
		res.render("no-configuration.hbs", {
			nonce: res.locals.nonce
		});
		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.NotConfiguredScreenEventName,
			jiraHost
		});
		return;
	}

	const url = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
	const encodedJiraHost = encodeURIComponent(jiraHost);
	// Only has cloud instance
	if (servers.hasCloudServer && servers.gheServerInfos.length == 0) {
		res.redirect(`/github/create-branch${url.search}&jiraHost=${encodedJiraHost}`);
		return;
	}
	// Only single GitHub Enterprise connected
	if (!servers.hasCloudServer && servers.gheServerInfos.length == 1) {
		res.redirect(`/github/${servers.gheServerInfos[0].uuid}/${redirectPath}${url.search}&jiraHost=${encodedJiraHost}`);
		return;
	}

	res.render("github-create-branch-options.hbs", {
		nonce: res.locals.nonce,
		jiraHost,
		servers
	});

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.CreateBranchOptionsScreenEventName,
		jiraHost
	});

};

const getJiraHostFromTenantUrl = (jiraHostParam) =>  {
	const siteName = jiraHostParam?.substring(0, jiraHostParam?.indexOf("."));
	return `https://${siteName}.atlassian.net`;
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


