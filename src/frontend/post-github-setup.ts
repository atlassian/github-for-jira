import { jiraDomainOptions, validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../util/getUrl";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

/*
When this request is made: Installing from GitHub marketplace.
Renders https://jira.github.com/github/setup and prompts user to enter a Jira site.
User is either prompted to login into GitHub, or if already logged in, is redirected to Jira Marketplace.
*/
export default async (req: Request, res: Response): Promise<void> => {
	const { jiraSubdomain, jiraDomain } = req.body;

	req.log.info(
		`Received github setup page request for jira ${jiraSubdomain}.atlassian.net`
		// `Received github setup page request for jira ${jiraSubdomain}.${jiraDomain}`
	);

	req.log.info("RES: ", res)

	// TODO UPDATE CORRECTLY AFTER JADE UPDATES
	if (!validJiraDomains(jiraSubdomain, "atlassian.net")) {
		res.status(400);

		if (await booleanFlag(BooleanFlags.NEW_SETUP_PAGE, true)) {
			return res.render("github-setup.hbs", {
				error: "The entered Jira Cloud Site is not valid",
				jiraSubdomain,
				nonce: res.locals.nonce,
				jiraDomainOptions: jiraDomainOptions("atlassian.net"),
				csrfToken: req.csrfToken(),
			});
		} else {
			return res.render("github-setup-OLD.hbs", {
				error: "The entered Jira Cloud Site is not valid",
				jiraSubdomain,
				nonce: res.locals.nonce,
				jiraDomainOptions: jiraDomainOptions(jiraDomain),
				csrfToken: req.csrfToken(),
			});
		}
	}

	req.session.jiraHost = `https://${jiraSubdomain}.atlassian.net`;
	// req.session.jiraHost = `https://${jiraSubdomain}.${jiraDomain}`;

	res.redirect(
		req.session.githubToken
			? getJiraMarketplaceUrl(req.session.jiraHost)
			: "/github/login"
	);
};
