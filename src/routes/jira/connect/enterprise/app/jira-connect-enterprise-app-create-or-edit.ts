import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { envVars } from "config/env";

export const JiraConnectEnterpriseAppCreateOrEdit = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira create or edit app page request");
		let config;
		const uuid = req.params.uuid;

		if (uuid) {
			const app = await GitHubServerApp.findForUuid(uuid);
			config = {
				app,
				serverUrl: app?.gitHubBaseUrl,
				appUrl: envVars.APP_URL,
				uuid,
				csrfToken: req.csrfToken()
			};
		} else {
			config = {
				serverUrl: req.params.serverUrl,
				appUrl: envVars.APP_URL,
				uuid: newUUID(),
				csrfToken: req.csrfToken()
			};
		}

		res.render("jira-manual-app-creation.hbs", config);
		req.log.debug("Jira create or edit app page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira create or edit app page: ${error}`));
	}
};
