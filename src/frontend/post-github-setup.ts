import axios from "axios";
import { jiraTopleveldomainOptions, validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../util/getUrl";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

const renderGitHubSetupPageVersion = async (
	domain: string,
	topLevelDomain: string,
	res: Response,
	req: Request,
	jiraSiteUrl?: string
) => {
	const newGithubSetupPgFlagIsOn = await booleanFlag(
		BooleanFlags.NEW_SETUP_PAGE,
		false,
		jiraSiteUrl
	);

	const setupPageVersion = newGithubSetupPgFlagIsOn
		? "github-setup.hbs"
		: "github-setup-OLD.hbs";

	const newGitHubSetupPagePayload = {
		error: "The entered Jira Cloud site is not valid.",
		domain,
		nonce: res.locals.nonce,
		csrfToken: req.csrfToken(),
	};

	const oldGitHubSetupPagePayload = Object.assign(
		{},
		newGitHubSetupPagePayload
	);
	oldGitHubSetupPagePayload["jiraTopleveldomainOptions"] =
		jiraTopleveldomainOptions(topLevelDomain);

	return newGithubSetupPgFlagIsOn
		? res.render(setupPageVersion, newGitHubSetupPagePayload)
		: res.render(setupPageVersion, oldGitHubSetupPagePayload);
};

export default async (req: Request, res: Response): Promise<void> => {
	// TODO - clean up after NEW_SETUP_PAGE is removed
	const { jiraDomain, jiraDomainMain, jiraDomainModal, jiraTopleveldomain } =
		req.body;

	const domain = jiraDomain || jiraDomainMain || jiraDomainModal;
	const topLevelDomain = jiraTopleveldomain || "atlassian.net";
	const jiraSiteUrl = `https://${domain}.${topLevelDomain}`;

	req.log.info(
		`Received github setup page request for jira ${jiraSiteUrl}`
	);

	const newGithubSetupPgFlagIsOn = await booleanFlag(
		BooleanFlags.NEW_SETUP_PAGE,
		false
	);

	const siteUrlIncludesProtocol = newGithubSetupPgFlagIsOn
		? !validJiraDomains(domain, "atlassian.net")
		: !validJiraDomains(domain, topLevelDomain);

	if (siteUrlIncludesProtocol) {
		res.status(400);

		renderGitHubSetupPageVersion(domain, topLevelDomain, res, req, jiraSiteUrl);
	}

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
				req.session.jiraHost = `${jiraSiteUrl}`;

				res.redirect(
					req.session.githubToken
						? getJiraMarketplaceUrl(req.session.jiraHost)
						: "/github/login"
				);
			}
		})
		.catch((error) => {
			// If Jira site is not valid, it returns a 404
			req.log.error({error}, "Invalid Jira site entered.")
			renderGitHubSetupPageVersion(domain, topLevelDomain, res, req);
		});
};
