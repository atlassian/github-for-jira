import { jiraDomainOptions } from "./validations";
import { Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { getJiraMarketplaceUrl } from '../util/getUrl';

/*
When this request is made: Installing from Jira Marketplace - GitHub org does not have Jira installed.
Redirects users back to github/configuration to install their Jira instance in GitHub org/s.
If the installation was done from Jira Marketplace, the app is already installed.
*/
export default async (req: Request, res: Response): Promise<void> => {
	req.log.info("Received get github setup page request");

	if (await booleanFlag(BooleanFlags.NEW_SETUP_PAGE, true)) {
		res.render("github-setup.hbs", {
			jiraDomainOptions: jiraDomainOptions(),
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			jiraHost: req.session.jiraHost,
			hasNoHost: req.session.jiraHost == undefined,
			marketplaceUrl: getJiraMarketplaceUrl(req.session.jiraHost)
		});
	} else {
		res.render("github-setup-OLD.hbs", {
			jiraDomainOptions: jiraDomainOptions(),
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
		});
	}
};
