import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { getHashedKey } from "models/sequelize";
import { Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { createAppClient, createUserClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

const hasAdminAccess = async (gitHubAppClient: GitHubAppClient, gitHubUserClient: GitHubUserClient, gitHubInstallationId: number, logger: Logger): Promise<boolean>  => {
	try {
		const { data: { login } } = await gitHubUserClient.getUser();
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);

		return await isUserAdminOfOrganization(gitHubUserClient, installation.account.login, login, installation.target_type);
	}	catch (err) {
		logger.warn({ err }, "Error checking user access");
		return false;
	}
};

/**
 * Handle the when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppId } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

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
	req.log.debug("Received add subscription request");

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
		const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppId);

		// Check if the user that posted this has access to the installation ID they're requesting
		if (!await hasAdminAccess(gitHubAppClient, gitHubUserClient, gitHubInstallationId, req.log)) {
			res.status(401).json({ err: `Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation` });
			return;
		}

		const subscription = await Subscription.install({
			clientKey: getHashedKey(req.body.clientKey),
			plainClientKey: req.body.clientKey,
			installationId: gitHubInstallationId,
			host: jiraHost,
			gitHubAppId
		});

		await findOrStartSync(subscription, req.log);

		res.sendStatus(200);
	} catch (err) {
		req.log.error({ err, gitHubProduct }, "Error processing subscription add request");
		res.sendStatus(500);
	}
};
