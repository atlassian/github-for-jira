import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

export const JiraConnectEnterpriseAppCreateOrEdit = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira edit app page request");
		let config;
		const uuid = req.params.uuid as string ;

		if (uuid) {
			const app = await GitHubServerApp.findForUuid(uuid);
			config = {
				previousPagePath: "github-app-creation-page",
				app,
				serverUrl: app?.gitHubBaseUrl,
				uuid,
				csrfToken: req.csrfToken()
			};
		} else {
			config = {
				previousPagePath: "github-app-creation-page",
				serverUrl: req.params.serverUrl,
				uuid: newUUID(),
				csrfToken: req.csrfToken()
			};
		}

		res.render("jira-manual-app-creation.hbs", config);
		req.log.debug("Jira edit app page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira edit app page: ${error}`));
	}
};
