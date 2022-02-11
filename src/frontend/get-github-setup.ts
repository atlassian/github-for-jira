import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "../util/jira-utils";
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

	const installationId = req.originalUrl.split("=")[1].split("&")[0]
	let redirectUrl = getJiraMarketplaceUrl(jiraHost);

	// If we know enough about user and site, redirect to the app
	if (jiraHost && await jiraSiteExists(jiraHost) && await Installation.getForHost(jiraHost)) {
		redirectUrl = getJiraAppUrl(jiraHost);
	}

	let installation;

	if (jiraHost) {
		installation = await Installation.getForHost(jiraHost);
	}

	const hasJiraHost = !!jiraHost;

	res.render("github-setup.hbs", {
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce,
		jiraHost,
		redirectUrl,
		hasJiraHost,
		clientKey: installation?.clientKey,
		id: installationId
	});
};
