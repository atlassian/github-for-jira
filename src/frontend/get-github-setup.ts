import { jiraDomainOptions } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from '../util/getUrl';

/*
When this request is made: Installing from Jira Marketplace - GitHub org does not have Jira installed.
Redirects users back to github/configuration to install their Jira instance in GitHub org/s.
If the installation was done from Jira Marketplace, the app is already installed.
*/
export default (req: Request, res: Response): void => {
	req.log.info("Received get github setup page request");

	if (req.session.jiraHost) {
		res.redirect(getJiraMarketplaceUrl(req.session.jiraHost));
	}

	res.render("github-setup.hbs", {
		jiraDomainOptions: jiraDomainOptions(),
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce
	});
};
