import { jiraTopleveldomainOptions, validJiraDomains } from './validations';
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../util/getUrl";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

/*
When this request is made: Installing from GitHub marketplace.
Renders https://jira.github.com/github/setup and prompts user to enter a Jira site.
User is either prompted to login into GitHub, or if already logged in, is redirected to Jira Marketplace.
*/
export default async (req: Request, res: Response): Promise<void> => {
	// TODO - clean up after NEW_SETUP_PAGE is removed
	const { jiraDomain, jiraDomainMain, jiraDomainModal, jiraTopleveldomain } = req.body;

	const domain = jiraDomain || jiraDomainMain || jiraDomainModal;
	const subdomain = jiraTopleveldomain || "atlassian.net";

	req.log.info(
		`Received github setup page request for jira ${domain}.${subdomain}`
	);

	const newgithubSetupPgFlagIsOn = await booleanFlag(BooleanFlags.NEW_SETUP_PAGE, true);
	const setupPageVersion = newgithubSetupPgFlagIsOn ? "github-setup.hbs" : "github-setup-OLD.hbs";
	const invalidDomain = newgithubSetupPgFlagIsOn ? !validJiraDomains(domain, "atlassian.net") : !validJiraDomains(domain, subdomain);
	// req.log.info("HERE: ", res);

	if (invalidDomain) {
		res.status(400);

		const setupPagePayload = {
			error: "The entered Jira Cloud Site is not valid",
			domain,
			nonce: res.locals.nonce,
			csrfToken: req.csrfToken(),
		}

		if (newgithubSetupPgFlagIsOn) {
			return res.render(setupPageVersion, setupPagePayload);
		} else {

			const setupPagePayloadOLD = Object.assign({}, setupPagePayload);
			setupPagePayloadOLD["jiraTopleveldomainOptions"] = jiraTopleveldomainOptions(subdomain)

			return res.render("github-setup-OLD.hbs", setupPagePayloadOLD);
		}
	}

	req.session.jiraHost = `https://${domain}.atlassian.net`;

	res.redirect(
		req.session.githubToken
			? getJiraMarketplaceUrl(req.session.jiraHost)
			: "/github/login"
	);
};
