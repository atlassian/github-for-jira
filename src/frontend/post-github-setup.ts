import axios from "axios";
import { validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../util/getUrl";

interface SetupPagePayload {
	error: string;
	domain: string;
	nonce: string;
	csrfToken: string;
}

const renderGitHubSetupPageVersion = async (
	domain: string,
	req: Request,
	res: Response
) => {
	const gitHubSetupPagePayload: SetupPagePayload = {
		error: "The entered Jira Cloud site is not valid.",
		domain,
		nonce: res.locals.nonce,
		csrfToken: req.csrfToken(),
	};

	res.render("github-setup.hbs", gitHubSetupPagePayload)
};

const validateJiraSite = (
	jiraSiteUrl: string,
	domain: string,
	req: Request,
	res: Response
): void => {
	// Check that the entered domain is valid by making a request to the status endpoint
	axios(`${jiraSiteUrl}/status`, {
		method: "GET",
		headers: {
			"content-type": "application/json",
		},
	})
		.then((response) => {
			// If Jira site is valid, response returns a state of RUNNING
			if (response?.data?.state === "RUNNING") {
				res.redirect(
					req.session.githubToken
						? getJiraMarketplaceUrl(jiraSiteUrl)
						: "/github/login"
				);
			}
		})
		.catch((error) => {
			// If Jira site is not valid, it returns a 404
			req.log.error({ error }, "Invalid Jira site entered.");
			renderGitHubSetupPageVersion(domain, req, res);
		});
};

export default async (req: Request, res: Response): Promise<void> => {
	const { jiraDomain, jiraDomainMain, jiraDomainModal } =
		req.body;

	const domain = jiraDomain || jiraDomainMain || jiraDomainModal;
	const topLevelDomain = "atlassian.net";
	const jiraSiteUrl = `https://${domain}.${topLevelDomain}`;

	req.log.info(`Received github setup page request for jira ${jiraSiteUrl}`);

	const siteUrlIncludesProtocol = !validJiraDomains(domain, topLevelDomain)

	if (siteUrlIncludesProtocol) {
		res.status(400);

		renderGitHubSetupPageVersion(domain, req, res);
	}

	validateJiraSite(jiraSiteUrl, domain, req, res);
};
