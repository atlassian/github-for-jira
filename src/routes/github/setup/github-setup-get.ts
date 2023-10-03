import { Request, Response } from "express";
import Logger from "bunyan";
import { getJiraAppUrl, getJiraMarketplaceUrl, isGitHubCloudApp, jiraSiteExists } from "utils/jira-utils";
import { Installation } from "models/installation";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { createAppClient } from "~/src/util/get-github-client-config";

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

const getInstallationData = async (githubAppClient: GitHubAppClient, githubInstallationId: number, logger: Logger) => {
	let githubInstallation;

	const { data: info } = await githubAppClient.getApp();

	// We want to proceed even if no installation is found.
	try {
		const installationRequest = await githubAppClient.getInstallation(githubInstallationId);
		githubInstallation = installationRequest.data;
	} catch (err: unknown) {
		logger.warn("Cannot retrieve Github Installation from API");
	}

	return {
		githubInstallation,
		info
	};
};

export const GithubSetupGet = async (req: Request, res: Response): Promise<void> => {

	const githubInstallationId = Number(req.query.installation_id);

	const { jiraHost, gitHubAppId } = res.locals;
	const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId, { trigger: "github-setup-get" });
	const { githubInstallation, info } = await getInstallationData(gitHubAppClient, githubInstallationId, req.log);

	req.addLogFields({ githubInstallationId, appInfo: info });
	req.log.debug("Received get github setup page request");

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
		orgName: githubInstallation?.account?.login,
		avatar: githubInstallation?.account?.avatar_url,
		html_url: info.html_url,
		id: githubInstallationId,
		isGitHubCloudApp: await isGitHubCloudApp(gitHubAppId)
	});
};
