import { NextFunction, Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";

export const JiraConnectEnterpriseAppPut = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	req.log.debug("Received Jira Connect Enterprise App PUT request to update app.");

	try {
		const verifiedApp = await GitHubServerApp.getForUuidAndInstallationId(req.params.uuid, res.locals.installation.id);

		if (!verifiedApp) {
			res.status(200).send({ success: false, message: "No GitHub App found. Cannot update." });
			return next(new Error("No GitHub App found for provided UUID and installationId."));
		}

		await GitHubServerApp.updateGitHubAppByUUID(req.body);

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise App updated successfully.");
	} catch (error) {
		res.status(200).send({ success: false, message: "Failed to update GitHub App." });
		return next(new Error(`Failed to update GitHub app: ${error}`));
	}
};
