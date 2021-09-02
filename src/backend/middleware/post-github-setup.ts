import { jiraDomainOptions, validJiraDomains } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../../common/getUrl";

/*
When this request is made: Installing from GitHub marketplace.
Renders https://jira.github.com/github/setup and prompts user to enter a Jira site.
User is either prompted to login into GitHub, or if already logged in, is redirected to Jira Marketplace.
*/
export default (req: Request, res: Response): void => {
	const { jiraSubdomain, jiraDomain } = req.body;

	req.log.info(`Received github setup page request for jira ${jiraSubdomain}.${jiraDomain}`);

	if (!validJiraDomains(jiraSubdomain, jiraDomain)) {
		res.status(400);
		return res.render("github-setup.hbs", {
			error: "The entered Jira Cloud Site is not valid",
			jiraSubdomain,
			nonce: res.locals.nonce,
			jiraDomainOptions: jiraDomainOptions(jiraDomain),
			csrfToken: req.csrfToken()
		});
	}

	req.session.jiraHost = `https://${jiraSubdomain}.${jiraDomain}`;

	res.redirect(
		req.session.githubToken
			? getJiraMarketplaceUrl(req.session.jiraHost)
			: "/github/login"
	);
};
