import { Request, Response } from "express";
import { GitHubServerApp } from "models/github-server-app";

export const JiraConnectEnterpriseAppPost = async (
	req: Request,
	res: Response
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

		await GitHubServerApp.install({
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

		res.status(202).send();

		req.log.debug("Jira Connect Enterprise App added successfully.");
	} catch (err) {
		req.log.warn({ err }, "Could not create the app");
		res.status(500).send({ message: "Failed to create GitHub App." });
	}
};
