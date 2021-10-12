import { jiraDomainOptions } from "./validations";
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
export default (req: Request, res: Response): void => {
	req.log.info("Received get github setup page request");

	if (req.headers.referer) {
		const { host: githubHost } = req;
		const { jwt, jiraHost } = req.session;

		res.redirect(getGitHubConfigurationUrl(githubHost, jwt, jiraHost));
	} else if (req.session.jiraHost) {
		res.redirect(getJiraMarketplaceUrl(req.session.jiraHost));
	} else {
		res.render("github-setup.hbs", {
			jiraDomainOptions: jiraDomainOptions(),
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
		});
	}
};
