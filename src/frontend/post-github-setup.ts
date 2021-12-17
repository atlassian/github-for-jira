import axios from "axios";
import { validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl } from "../util/get-url";
import { Installation } from "../models";

interface SetupPagePayload {
	error: string;
	domain: string;
	nonce: string;
	csrfToken: string;
}

const renderGitHubSetupPageVersion = (
	domain: string,
	req: Request,
	res: Response
):void => {
	const gitHubSetupPagePayload: SetupPagePayload = {
		error: "The entered Jira Cloud site is not valid.",
		domain,
		nonce: res.locals.nonce,
		csrfToken: req.csrfToken(),
	};

	res.render("github-setup.hbs", gitHubSetupPagePayload)
};

const validateJiraSite = async (
	jiraHost: string,
	domain: string,
	req: Request,
	res: Response
): Promise<void> => {

	// Check to see if we already have an installation of the app
	if(await Installation.getForHost(jiraHost)) {
		// If so, redirect to the app itself
		return res.redirect(getJiraAppUrl(jiraHost));
	}

	try {
		// Check that the entered domain is valid by making a request to the status endpoint
		await axios(`${jiraHost}/status`, {
			method: "GET",
			headers: {
				"content-type": "application/json",
			},
		});

		// if 200 returns, it's valid and can redirect to the marketplace
		// for the user to install the app
		return res.redirect(getJiraMarketplaceUrl(jiraHost));
	}catch(err) {
		// If Jira site is not valid, it returns a 404
		req.log.error(err, "Invalid Jira site entered.");
		renderGitHubSetupPageVersion(domain, req, res);
	}
};

export default async (req: Request, res: Response): Promise<void> => {
	const { jiraDomain, jiraDomainMain, jiraDomainModal } = req.body;

	const domain = jiraDomain || jiraDomainMain || jiraDomainModal;
	const topLevelDomain = "atlassian.net";
	const jiraSiteUrl = `https://${domain}.${topLevelDomain}`;

	req.log.info(`Received github setup page request for jira ${jiraSiteUrl}`);

	if (!validJiraDomains(domain, topLevelDomain)) {
		res.status(400);
		return renderGitHubSetupPageVersion(domain, req, res);
	}

	await validateJiraSite(jiraSiteUrl, domain, req, res);
};
