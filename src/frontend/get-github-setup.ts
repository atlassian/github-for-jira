import { jiraDomainOptions } from "./validations";
import { NextFunction, Request, Response } from "express";
import { getGitHubConfigurationUrl } from "../util/getUrl";

/*
When this request is made: Installing from Jira Marketplace - GitHub org does not have Jira installed.
Redirects users back to github/configuration to install their Jira instance in GitHub org/s.
If the installation was done from Jira Marketplace, the app is already installed.
*/
export default (req: Request, res: Response, next: NextFunction): void => {
	req.log.info("Received get github setup page request");
	const { host: githubHost } = req;
	const { jwt, jiraHost } = req.session;
	if (jiraHost && jwt) {
		return res.redirect(getGitHubConfigurationUrl({ githubHost, jwt, jiraHost }));
	}

	res.render("github-setup.hbs", {
		jiraDomainOptions: jiraDomainOptions(),
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce
	});
	next();
};
