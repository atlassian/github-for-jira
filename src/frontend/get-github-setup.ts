import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl } from "../util/get-url";
import { Installation } from "../models";

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
	const { jiraHost } = res.locals;
	if (jiraHost && !!(await Installation.getForHost(jiraHost))) {
		return res.redirect(getJiraAppUrl(jiraHost));
	}

	res.render("github-setup.hbs", {
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce,
		jiraHost,
		marketplaceUrl: getJiraMarketplaceUrl(jiraHost) // only used is jiraHost is present
	});
};
