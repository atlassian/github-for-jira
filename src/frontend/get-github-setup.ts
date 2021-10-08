import { jiraDomainOptions } from "./validations";
import { Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
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
		const marketplaceUrl = req.session.jiraHost
			? getJiraMarketplaceUrl(req.session.jiraHost)
			: "";
		const shouldDisplayForm = req.session.jiraHost ? "false" : "true";

		if (await booleanFlag(BooleanFlags.NEW_SETUP_PAGE, true)) {
			res.render("github-setup.hbs", {
				csrfToken: req.csrfToken(),
				nonce: res.locals.nonce,
				displayForm: shouldDisplayForm,
				jiraHost: req.session.jiraHost,
				hasNoHost: req.session.jiraHost == undefined,
				marketplaceUrl, // only used is jiraHost is present
			});
		} else {
			res.render("github-setup-OLD.hbs", {
				jiraDomainOptions: jiraDomainOptions(),
				csrfToken: req.csrfToken(),
				nonce: res.locals.nonce,
			});
		}
	}
};
