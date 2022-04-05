import { Request, Response } from "express";
import Logger from "bunyan";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "utils/jira-utils";
import { Installation } from "models/installation";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { getCloudInstallationId } from "~/src/github/client/installation-id";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubAPI } from "probot";

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

const getInstallationData = async (githubInstallationId: number, jiraHost: string, logger: Logger, client: GitHubAPI) => {
	const githubAppClient = new GitHubAppClient(getCloudInstallationId(githubInstallationId), logger);
	const useNewGithubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GITHUB_SETUP, false, jiraHost);
	let githubInstallation;

	const { data: info } = useNewGithubClient ?
		await githubAppClient.getApp() :
		await client.apps.getAuthenticated();

	// We want to proceed even if no installation is found.
	try {
		const installationRequest = useNewGithubClient ?
			await githubAppClient.getInstallation(githubInstallationId) :
			await client.apps.getInstallation({ installation_id: githubInstallationId });

		githubInstallation = installationRequest.data;
	} catch (err) {
		logger.warn("Cannot retrieve Github Installation from API");
	}

	return {
		githubInstallation,
		info
	};
};

export const GithubSetupGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, client } = res.locals;
	const githubInstallationId = Number(req.query.installation_id);
	const { githubInstallation, info } = await getInstallationData(githubInstallationId, jiraHost, req.log, client);

	req.addLogFields({ githubInstallationId, appInfo: info });
	req.log.info("Received get github setup page request");

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
		id: githubInstallationId
	});
};
