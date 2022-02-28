import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "../../../util/jira-utils";
import { Installation } from "../../../models";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { getLogger } from "../../../config/logger";

const logger = getLogger("github-setup");

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
	req.log.info("Received get github setup page request");
	const { jiraHost, github, client } = res.locals;
	const installationId = Number(req.query.installation_id);
	const { data: info } = await client.apps.getAuthenticated();
	const githubInstallation = await getGithubInstallation(github, installationId)
		.catch(() => {
			// if we cannot get github installation, try to log as much as possible to help debug
			req.log.warn({appInfo: info, jiraHost, installationId}, "Cannot retrieve Github Installation from API")
		});


	// If we know enough about user and site, redirect to the app
	const [siteExists, jiraInstallation] = await Promise.all([
		jiraSiteExists(jiraHost),
		Installation.getForHost(jiraHost)
	]);

	const redirectUrl = siteExists && jiraInstallation ? getJiraAppUrl(jiraHost) : getJiraMarketplaceUrl(jiraHost);
	const hasJiraHost = !!jiraHost;
	const login = githubInstallation?.account?.login;
	const avatar_url = githubInstallation?.account?.avatar_url;

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
const wait = async (time:number) => {
	logger.info(`Waiting for ${time}ms`);
	return new Promise(resolve => setTimeout(resolve, time));
}
const getGithubInstallation = async (github:GitHubAPI, installationId:number):Promise<Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem> => {
	let num = 0;
	const call = async () => {
		num++;
		const { data: { installations } } = await github.apps.listInstallationsForAuthenticatedUser();
		const installation = installations.find((item) => item.id === installationId);
		logger.info({installations, installation}, `Getting Installation for User #${num}`);
		return installation ? Promise.resolve(installation) : Promise.reject();
	}
	// Try 3 times while waiting between calls before giving up
	return call()
		.catch(() => wait(1000).then(call))
		.catch(() => wait(2000).then(call))
}
