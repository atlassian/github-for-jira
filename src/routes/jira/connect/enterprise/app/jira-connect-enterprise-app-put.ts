import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";

export const JiraConnectEnterpriseAppPut = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App PUT request");
		console.log("BODY", req.body);

		await GitHubServerApp.updateGitHubApp(req.body);

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise App updated successfully.", res.locals);
	} catch (error) {
		res.status(200).send({ success: false, message: "Failed to update GitHub App." });
		return next(new Error(`Failed to render Jira Connect Enterprise App PUT request: ${error}`));
	}
};
