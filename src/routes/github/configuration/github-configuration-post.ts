import { GitHubAPI } from "probot";
import Logger from "bunyan";
import { Subscription } from "models/subscription";
import { getHashedKey } from "models/sequelize";
import { Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { createAppClient, createUserClient } from "~/src/util/get-github-client-config";

const hasAdminAccess = async (gitHubAppClient: GitHubAppClient | GitHubAPI, gitHubUserClient: GitHubUserClient, gitHubInstallationId: number, logger: Logger): Promise<boolean>  => {
	try {
		const { data: { login } } = await gitHubUserClient.getUser();
		const { data: installation } = gitHubAppClient instanceof GitHubAppClient ?
			await gitHubAppClient.getInstallation(gitHubInstallationId) :
			await gitHubAppClient.apps.getInstallation({ installation_id: gitHubInstallationId });

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
	const { githubToken, jiraHost, client } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

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
	req.log.info("Received add subscription request");

	try {
		const useNewGithubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GITHUB_CONFIG_POST, false, jiraHost);
		const gitHubUserClient = await createUserClient(gitHubInstallationId, githubToken, req.log, jiraHost);
		const gitHubAppClient = await createAppClient(gitHubInstallationId, req.log, jiraHost);

		// Check if the user that posted this has access to the installation ID they're requesting
		if (!await hasAdminAccess(useNewGithubClient ? gitHubAppClient : client, gitHubUserClient, gitHubInstallationId, req.log)) {
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
