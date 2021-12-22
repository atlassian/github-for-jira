import axios from "axios";
import { validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl } from "../util/get-url";
import { Installation } from "../models";

const validateJiraSite = async (
	req: Request,
	res: Response,
	jiraHost: string
): Promise<void> => {

	// Check to see if we already have an installation of the app
	if(await Installation.getForHost(jiraHost)) {
		// If so, redirect to the app itself
		res.send({redirect: getJiraAppUrl(jiraHost)});
		return;
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
		res.send({redirect: getJiraMarketplaceUrl(jiraHost)});
		return;
	}catch(err) {
		// If Jira site is not valid, it returns a 404
		req.log.error(err, "Invalid Jira site entered.");
		res.status(400).send({error: "The entered Jira Cloud site is not valid.", url: jiraHost});
		return;
	}
};

export default async (req: Request, res: Response): Promise<void> => {
	const { jiraDomain, jiraDomainMain, jiraDomainModal } = req.body;

	const domain = jiraDomain || jiraDomainMain || jiraDomainModal;
	const topLevelDomain = "atlassian.net";
	const jiraHost = `https://${domain}.${topLevelDomain}`;

	req.log.info(`Received github setup page request for jira ${jiraHost}`);

	if (!validJiraDomains(domain, topLevelDomain)) {
		res.status(400).send({error: "The entered Jira Cloud site is not valid.", url: jiraHost});
		return;
	}

	await validateJiraSite(req, res, jiraHost);
};
