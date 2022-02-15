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
	const { jiraHost, isAdmin } = res.locals;

	const installationId = req.originalUrl.split("=")[1].split("&")[0]
	let redirectUrl = getJiraMarketplaceUrl(jiraHost);

	const {	github, client } = res.locals;

	const { data: { installations } } = await github.apps.listInstallationsForAuthenticatedUser();
	const { data: { login } } = await github.users.getAuthenticated();
	const { data: info } = await client.apps.getAuthenticated();

	const installation = installations.filter((item) => item.id === Number(installationId));

	const admin = await isAdmin({
		org: installation[0]?.account?.login,
		username: login,
		type: installation[0]?.target_type || ""
	});

	// If we know enough about user and site, redirect to the app
	if (jiraHost && await jiraSiteExists(jiraHost) && await Installation.getForHost(jiraHost)) {
		redirectUrl = getJiraAppUrl(jiraHost);
	}

	let jiraInstallation;

	if (jiraHost) {
		jiraInstallation = await Installation.getForHost(jiraHost);
	}

	const hasJiraHost = !!jiraHost;

	res.render("github-setup.hbs", {
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce,
		jiraHost,
		redirectUrl,
		hasJiraHost,
		clientKey: jiraInstallation?.clientKey,
		orgName: installation[0]?.account?.login,
		avatar: installation[0]?.account?.avatar_url,
		html_url: info.html_url,
		admin,
		id: installationId // can't use this is they switch (reset id and send to marketplace)
	});
};
