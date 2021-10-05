import { jiraDomainOptions } from "./validations";
import { Request, Response } from "express";
import { getJiraMarketplaceUrl } from "../util/getUrl";

export default (req: Request, res: Response): void => {
	req.log.info("Received get github setup page request");

	req.log.info("SESSION: ", req.headers);

	if (req.headers.referer) {
		
	} else if (req.session.jiraHost) {
		res.redirect(getJiraMarketplaceUrl(req.session.jiraHost));
	} else {
		res.render("github-setup.hbs", {
			jiraDomainOptions: jiraDomainOptions(),
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
		});
	}
};
