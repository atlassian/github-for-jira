import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "../util/jira-utils";
import { Installation } from "../models";

/*
	Handles redirects for both the installation flow from Jira and
	the installation flow from GH.
	- From Jira: user has already installed but wants to connect to an org not listed. Ater selecting an org in GH and giving repo permissions:
		- they use the jiraHost we have in the cookie, connect, and are redirected to the GH config page
		- they choose to enter an alternate jiraHost and are redirected to marketplace
	- From GH:
		- If we have the users Jira host, redirect to marketplace.
		- Otherwise, render the setup page (POST).
*/
export default async (req: Request, res: Response): Promise<void> => {
	req.log.info("Received get github setup page request");
	const { jiraHost, github, client } = res.locals;
	const { data: { installations } } = await github.apps.listInstallationsForAuthenticatedUser();
	const { data: info } = await client.apps.getAuthenticated();
	const installationId = req.query.installation_id;
	const installation = installations.find((item) => item.id === Number(installationId));

	if (!installation) {
		throw new Error(`Error retrieving installation:${installationId}. App not installed on org.`);
	}

	let redirectUrl = getJiraMarketplaceUrl(jiraHost);

	// If we know enough about user and site, redirect to the app
	if (jiraHost && await jiraSiteExists(jiraHost) && await Installation.getForHost(jiraHost)) {
		redirectUrl = getJiraAppUrl(jiraHost);
	}

	let jiraInstallation;

	if (jiraHost) {
		jiraInstallation = await Installation.getForHost(jiraHost);
	}

	const hasJiraHost = !!jiraHost;
	const { account } = installation;
	const { login, avatar_url } = account;

	res.render("github-setup.hbs", {
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce,
		jiraHost,
		redirectUrl,
		hasJiraHost,
		clientKey: jiraInstallation?.clientKey,
		orgName: login,
		avatar: avatar_url,
		html_url: info.html_url,
		id: installationId
	});
};
