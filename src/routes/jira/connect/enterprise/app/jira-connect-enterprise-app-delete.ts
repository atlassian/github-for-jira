import { Request, Response } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";

type ResponseType =  Response<
	{
		success: true,
	}
	| {
		message: string
	}
	| {
		success: false,
		message: string
	},
	GitHubAppVerifiedLocals
>;
export const JiraConnectEnterpriseAppDelete = async (
	req: Request,
	res: ResponseType
): Promise<void> => {
	try {
		req.log.debug("Received Jira Connect Enterprise App DELETE request");

		const { gitHubAppConfig } = res.locals;
		if (!gitHubAppConfig || !gitHubAppConfig.uuid) {
			req.log.warn("Refuse to delete app due to GitHubServerApp not found");
			res.status(404).json({ message: "No GitHub App found. Cannot delete." });
			return;
		}

		await GitHubServerApp.uninstallApp(gitHubAppConfig.uuid);

		res.status(200).json({ success: true });
		req.log.debug("Jira Connect Enterprise App deleted successfully.");
	} catch (error) {
		req.log.error({ error }, "Failed to delete app due error");
		res.status(200).json({ success: false, message: "Failed to delete GitHub App." });
		return;
	}
};
