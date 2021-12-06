import { Request, Response } from "express";
import {
	getJiraMarketplaceUrl,
	getGitHubConfigurationUrl,
} from "../util/getUrl";

/*
	Handles redirects for both the installation flow from Jira and
	the installation flow from GH.
	- From Jira: user has already installed the app and is redirected to the connect an org pg
	- From GH:
			- If we have the users Jira host, redirect to marketplace.
			- Otherwise, render the setup page.
*/
export default async (req: Request, res: Response): Promise<void> => {
	req.log.info("Received get github setup page request");

	if (req.headers.referer) {
		const { host: githubHost } = req;
		const { jwt, jiraHost } = req.session;

		res.redirect(getGitHubConfigurationUrl(githubHost, jwt, jiraHost));
	} else {
		const jiraHost = req.session?.jiraHost;
		const marketplaceUrl = jiraHost
			? getJiraMarketplaceUrl(jiraHost)
			: undefined;

		res.render("github-setup.hbs", {
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			jiraHost: jiraHost,
			marketplaceUrl, // only used is jiraHost is present
		});
	}
};
