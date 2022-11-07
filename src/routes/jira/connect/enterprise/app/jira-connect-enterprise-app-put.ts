import { Request, Response, NextFunction } from "express";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { JiraAndGitHubVerifiedLocals } from "routes/route-types";

type ResponseErrorBody = {
	message: string;
}

export const JiraConnectEnterpriseAppPut = async (
	req: Request,
	res: Response<ResponseErrorBody, JiraAndGitHubVerifiedLocals>,
	next: NextFunction
): Promise<void> => {
	req.log.debug("Received Jira Connect Enterprise App PUT request to update app.");
	try {
		const { gitHubAppConfig: verifiedApp } = res.locals;

		if (!verifiedApp.gitHubAppId || !verifiedApp.uuid || verifiedApp.uuid !== req.body.uuid) {
			res.status(404).send({ message: "No GitHub App found. Cannot update." });
			return next(new Error("No GitHub App found for provided UUID and installationId."));
		}

		const existingGitHubServerApp = await GitHubServerApp.findForUuid(verifiedApp.uuid);
		if (!existingGitHubServerApp) {
			res.status(404).send({ message: "No GitHub App found. Cannot update." });
			return next(new Error("No GitHub App found for provided UUID and installationId."));
		}

		const updatedAppPayload = { ...req.body };
		if (!updatedAppPayload.privateKey) {
			updatedAppPayload.privateKey = await existingGitHubServerApp.getDecryptedPrivateKey();
		}

		await GitHubServerApp.updateGitHubAppByUUID(req.body);

		res.status(202).send();
		req.log.debug("Jira Connect Enterprise App updated successfully.");
	} catch (error) {
		res.status(404).send({ message: "Failed to update GitHub App." });
		return next(new Error(`Failed to update GitHub app: ${error}`));
	}
};
