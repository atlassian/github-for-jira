import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "utils/jira-utils";
import { Installation } from "models/index";

/*
	Handles redirects for both the installation flow from Jira and
	the installation flow from GH.
	- From Jira: user has already installed but wants to connect to an org not listed. After selecting an org in GH and giving repo permissions:
		- they use the jiraHost we have in the cookie, connect, and are redirected to the GH config page
		- they choose to enter an alternate jiraHost and are redirected to marketplace
	- From GH:
		- If we have the users Jira host, redirect to marketplace.
		- Otherwise, render the setup page (POST).
*/
export const GithubSetupGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, client } = res.locals;
	const installationId = Number(req.query.installation_id);
	const { data: info } = await client.apps.getAuthenticated();
	req.addLogFields({ installationId, appInfo: info });
	req.log.info("Received get github setup page request");
	const githubInstallation = await client.apps.getInstallation({ installation_id: installationId })
		.catch(() => {
			// if we cannot get github installation, try to log as much as possible to help debug
			req.log.warn("Cannot retrieve Github Installation from API");
		});

	// If we know enough about user and site, redirect to the app
	const [siteExists, jiraInstallation] = await Promise.all([
		jiraSiteExists(jiraHost),
		Installation.getForHost(jiraHost)
	]);

	const redirectUrl = siteExists && jiraInstallation ? getJiraAppUrl(jiraHost) : getJiraMarketplaceUrl(jiraHost);
	res.render("github-setup.hbs", {
		csrfToken: req.csrfToken(),
		nonce: res.locals.nonce,
		jiraHost,
		redirectUrl,
		clientKey: jiraInstallation?.clientKey,
		orgName: githubInstallation?.data.account?.login,
		avatar: githubInstallation?.data.account?.avatar_url,
		html_url: info.html_url,
		id: installationId
	});
};
