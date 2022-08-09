import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraConnectEnterpriseAppPost = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App POST request");

		const { installation } = res.locals;
		const {
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey
		} = req.body;

		const githubServerApp = await GitHubServerApp.install({
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId: installation.id
		});

		res.status(200).send({ success: true, data: githubServerApp });

		req.log.debug("Jira Connect Enterprise App added successfully.");
	} catch (error) {
		res.status(200).send({ success: false, message: "Failed to create GitHub App." });
		return next(new Error(`Failed to render Jira Connect Enterprise App POST request: ${error}`));
	}
};
