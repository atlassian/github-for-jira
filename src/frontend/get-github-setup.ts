import { jiraTopleveldomainOptions } from "./validations";
import { Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { getGitHubConfigurationUrl, getJiraMarketplaceUrl } from "../util/getUrl";

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
	const { jiraHost } = req.session;
	if (req.headers.referer && jiraHost) {
		return res.redirect(getGitHubConfigurationUrl(jiraHost));
	}
	const marketplaceUrl = jiraHost
		? getJiraMarketplaceUrl(jiraHost)
		: undefined;

	if (await booleanFlag(BooleanFlags.NEW_SETUP_PAGE, true, jiraHost)) {
		res.render("github-setup.hbs", {
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			jiraHost: jiraHost,
			marketplaceUrl // only used is jiraHost is present
		});
	} else {
		res.render("github-setup-OLD.hbs", {
			jiraTopleveldomainOptions: jiraTopleveldomainOptions(),
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce
		});
	}
};
