import { Request, Response, NextFunction } from "express";
import sanitize from "sanitize-html";

export const GitHub5KURedirectHandler = (req: Request, res: Response, next: NextFunction) => {
	/**
	 * If the user is installing from Jira's side, then there always will be a state
	 * For spa views, it should be `spa-cloud`, no `spa-enterprise` yet
	 * And for the existing views, it should be `non-spa-cloud` for cloud flow,
	 * and it should be `non-spa-enterprise` for enterprise flow
	 *
	 * If there is no state, that means the user is installing from GitHub side
	 */
	const state = req.query["state"];

	switch (state) {
		case "spa": {
			const sanitizedGitHubInstallationId: string = sanitize(String(req.query.installation_id || ""));
			const sanitizedSetupAction: string = sanitize(String(req.query.setup_action || ""));
			if (sanitizedGitHubInstallationId) {
				res.redirect(`/rest/app/cloud/github-installed?installation_id=${sanitizedGitHubInstallationId}`);
			} else if (sanitizedSetupAction) {
				res.redirect(`/rest/app/cloud/github-requested?setup_action=${sanitizedSetupAction}`);
			} else {
				res.status(422).send("Missing information");
			}
			return;
		}
		case "non-spa":
			next();
			break;
		default:
			// Redirecting the user to marketplace page, when installing from GitHub side
			res.redirect(`https://marketplace.atlassian.com/apps/1219592/github-for-jira?tab=overview`);
			return;
	}
};

