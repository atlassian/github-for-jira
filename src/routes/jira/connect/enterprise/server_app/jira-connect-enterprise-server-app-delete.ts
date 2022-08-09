import { NextFunction, Request, Response } from "express";
// import { GitHubServerApp } from "models/github-server-app";

export const JiraConnectEnterpriseServerAppDelete = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise Server DELETE request");

		const baseUrl = req.body.serverUrl as string;

		if (!baseUrl) {
			throw new Error("No server URL passed!");
		}

		// make request to backend to delete all insstances with baseUrl
		res.status(200).send({ success: true })
		req.log.debug("Jira Connect Enterprise Server successfully deleted.");
	} catch (error) {
		return next(new Error(`Failed to DELETE GitHub Enterprise Server: ${error}`));
	}
};
