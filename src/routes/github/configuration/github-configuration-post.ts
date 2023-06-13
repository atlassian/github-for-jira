import { Request, Response } from "express";

import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

/**
 * Handle when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, gitHubAppId, installation } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

	if (!githubToken) {
		req.log.warn("GitHub token wasn't found");
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.error) {
		res.status(401)
			.json({
				err: result.error
			});
		return;
	}

	res.sendStatus(200);
};
