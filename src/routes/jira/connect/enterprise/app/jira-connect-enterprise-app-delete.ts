import { Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";

export const JiraConnectEnterpriseAppDelete = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App DELETE request");

		const { gitHubAppConfig } = res.locals;
		if (!gitHubAppConfig || !gitHubAppConfig.uuid) {
			res.status(404).send({ message: "No GitHub App found. Cannot delete." });
			return;
		}

		await GitHubServerApp.uninstallApp(gitHubAppConfig.uuid);

		res.status(200).send({ success: true });
		req.log.debug("Jira Connect Enterprise App deleted successfully.");
	} catch (error) {
		res.status(200).send({ success: false, message: "Failed to delete GitHub App." });
		return;
	}
};
