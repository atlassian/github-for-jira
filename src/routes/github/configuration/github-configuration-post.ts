import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { getHashedKey } from "models/sequelize";
import { Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { getCloudInstallationId } from "~/src/github/client/installation-id";

const hasAdminAccess = async (gitHubInstallationId: number, githubToken: string, logger: Logger): Promise<boolean>  => {
	const gitHubUserClient = new GitHubUserClient(githubToken, logger);
	const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(gitHubInstallationId), logger);

	try {		
		const { data: { login } } =  await gitHubUserClient.getUser();
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);
		return await isUserAdminOfOrganization(gitHubUserClient, installation.account.login, login, installation.target_type);
	}	catch (err) {
		logger.warn({ err }, "Error checking user access");
		return false;
	}
}

/**
 * Handle the when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}
	const gitHubInstallationId = Number(req.body.installationId);

	if (!gitHubInstallationId) {
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	if (!req.body.clientKey) {
		res.status(400)
			.json({
				err: "A clientKey must be provided to link an installation."
			});
		return;
	}

	req.addLogFields({ gitHubInstallationId });
	req.log.info("Received add subscription request");

	try {
		
		// Check if the user that posted this has access to the installation ID they're requesting
		if (!await hasAdminAccess(gitHubInstallationId, githubToken, req.log)) {
			res.status(401).json({ err: `Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation` });
			return;
		}

		const subscription = await Subscription.install({
			clientKey: getHashedKey(req.body.clientKey),
			installationId: gitHubInstallationId,
			host: jiraHost
		});

		await findOrStartSync(subscription, req.log);

		res.sendStatus(200);
	} catch (err) {
		req.log.error(err, "Error processing subscription add request");
		res.sendStatus(500);
	}
};
