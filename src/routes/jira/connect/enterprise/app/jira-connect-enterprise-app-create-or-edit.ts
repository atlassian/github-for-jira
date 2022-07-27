import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraConnectEnterpriseAppCreateOrEdit = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira create or edit app page request");

		const uuid = req.params.uuid;
		if (!uuid) {
			res.status(401).send("Missing UUID");
			return;
		}

		const app = await GitHubServerApp.findForUuid(uuid);

		res.render("jira-manual-app-creation.hbs", {
			previousPagePath: "github-app-creation-page",
			app
		});

		req.log.debug("Jira create or edit page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira create or edit app page: ${error}`));
	}
};
