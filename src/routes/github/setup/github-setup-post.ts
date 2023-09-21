import { validJiraDomain } from "utils/validations";
import { Request, Response } from "express";
import { getJiraAppUrl, getJiraMarketplaceUrl, jiraSiteExists } from "utils/jira-utils";
import { Installation } from "models/installation";

const validateJiraSite = async (
	req: Request,
	res: Response,
	jiraHost: string
): Promise<void> => {

	if (!(await jiraSiteExists(jiraHost))) {
		// If Jira site is not valid, it returns a 404
		req.log.error({ url: jiraHost }, "Invalid Jira site entered.");
		res.status(400).json({ error: "The entered Jira Cloud site is not valid.", url: jiraHost });
	}

	// Check to see if we already have an installation of the app
	const installation = await Installation.getForHost(jiraHost);

	// If installation exists redirect to the app itself or else
	// redirect to the marketplace for the user to install the app
	res.json({ redirect: installation ? getJiraAppUrl(jiraHost) : getJiraMarketplaceUrl(jiraHost) });
};

export const GithubSetupPost = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, jiraDomain, jiraDomainMain, jiraDomainModal } = req.body;
	const domain: string = jiraDomain || jiraDomainMain || jiraDomainModal || "";
	const url = jiraHost || `https://${domain}.atlassian.net`;

	req.log.debug({ jiraHost: url }, `Received github setup page request for jira`);

	if (!validJiraDomain(url)) {
		res.status(400).send({ error: "The entered Jira Cloud site is not valid.", url });
		return;
	}

	await validateJiraSite(req, res, url);
};
