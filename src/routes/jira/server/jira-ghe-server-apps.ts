import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { Subscription } from "models/subscription";

export const JiraGheServerApps = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira GHE server apps page request");

		const { jiraHost, installation: { id: installationId } } = res.locals;
		const githubServerBaseUrl = req?.query.serverUrl as string;

		if (!githubServerBaseUrl) {
			throw new Error("No server URL passed!");
		}

		const servers = await GitHubServerApp.getAllForGitHubBaseUrl(githubServerBaseUrl, installationId);
		const serverIds = servers ? servers.map(server => server.id) : [];
		const allSubscriptions = await Subscription.getAllForHost(jiraHost);

		const subscriptions = allSubscriptions.filter(subscription => subscription.gitHubAppId && serverIds.includes(subscription.gitHubAppId));
		const serverApps = subscriptions.map(subscription => ({
			displayName: subscription.gitHubInstallationId
		}));

		if (serverApps.length) {
			res.render("jira-select-github-cloud-app.hbs", {
				servers: serverApps,
				previousPagePath: "github-list-servers-page"
			});
		} else {
			res.render("jira-select-app-creation.hbs", {
				previousPagePath: "github-list-servers-page"
			});
		}

		req.log.debug("Jira GHE server apps rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira GHE server apps page: ${error}`));
	}
};
