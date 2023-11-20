import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import { createAppClient, createInstallationClient, createUserClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;
	const { installationId: gitHubInstallationId } = req.body;
	const logger = req.log.child({ jiraHost, gitHubInstallationId });

	logger.info("Received DELETE subscription request");

	const gitHubAppId = gitHubAppConfig?.gitHubAppId;
	const metrics = {
		trigger: "github-subscription-delete"
	};
	const gitHubAppClient = await createAppClient(logger, jiraHost, gitHubAppId, metrics);
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraHost, { trigger: "github-subscription-delete" }, logger, gitHubAppId);
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, metrics, logger, gitHubAppId);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	if (!githubToken) {
		logger.info("No GitHub token found when trying to delete subscription.");
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId || !jiraHost) {
		logger.info("Missing gitHubInstallationId and/or jiraHost. Unable to delete subscription.");
		res.status(400).json({ err: "installationId and jiraHost must be provided to delete a subscription." });
		return;
	}

	try {
		// get the installation to see if the user is an admin of it
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);
		const { data: { login } } = await gitHubUserClient.getUser();

		// Only show the page if the logged in user is an admin of this installation
		if (!await isUserAdminOfOrganization(
			gitHubUserClient,
			gitHubInstallationClient ,
			installation.account.login,
			login,
			installation.target_type,
			logger
		)) {
			logger.warn("Not an admin");
			res.status(401).json({ err: `Unauthorized access to delete subscription.` });
			return;
		}

		try {
			const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
			if (!subscription) {
				logger.warn("Cannot find subscription");
				res.status(404).send("Cannot find Subscription.");
				return;
			}
			await subscription.destroy();
			res.sendStatus(202);
		} catch (err: unknown) {
			logger.warn("Cannot delete subscription");
			res.status(403).json({ err: `Failed to delete subscription.` });
		}

	} catch (err: unknown) {
		logger.error({ err, req, res, gitHubProduct }, "Error while processing delete subscription request");
		res.sendStatus(500);
	}
};
