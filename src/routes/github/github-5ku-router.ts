import { Request, Response, NextFunction } from "express";
import sanitize from "sanitize-html";

export const GitHub5KURedirectHandler = (req: Request, res: Response, next: NextFunction) => {
	if (req.query["state"] === "spa") {
		const sanitizedGitHubInstallationId: string = sanitize(String(req.query.installation_id || ""));
		const sanitizedSetupAction: string = sanitize(String(req.query.setup_action || ""));
		if (sanitizedGitHubInstallationId) {
			res.redirect(`/rest/app/cloud/github-installed?installation_id=${sanitizedGitHubInstallationId}`);
		} else if (sanitizedSetupAction) {
			res.redirect(`/rest/app/cloud/github-requested?setup_action=${sanitizedSetupAction}`);
		} else {
			res.status(422).send("Missing informations");
		}
		return;
	} else {
		next();
	}
};

