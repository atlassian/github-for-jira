import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { isUserAdminOfOrganization } from "~/src/util/github-utils";
import {getGitHubBaseUrl} from "utils/check-github-app-type";
import { gheServerAuthAndConnectFlowFlag } from "~/src/util/feature-flag-utils";

export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
	const { github, client, githubToken, jiraHost } = res.locals;
	const { installationId: gitHubInstallationId } = req.body;
	const logger = req.log.child({ jiraHost, gitHubInstallationId });
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);
	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DELETE_SUBSCRIPTION, true, jiraHost) ;
	const gitHubAppClient = new GitHubAppClient(logger, gitHubBaseUrl);
	const gitHubUserClient = await gheServerAuthAndConnectFlowFlag(jiraHost)
		? new GitHubUserClient(githubToken, logger, gitHubBaseUrl)
		: new GitHubUserClient(githubToken, logger);

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId || !jiraHost) {
		res.status(400).json({ err: "installationId and jiraHost must be provided to delete a subscription." });
		return;
	}

	logger.info("Received delete-subscription request");

	try {
		// get the installation to see if the user is an admin of it
		const { data: installation } = useNewGitHubClient ?
			await gitHubAppClient.getInstallation(gitHubInstallationId) :
			await client.apps.getInstallation({ installation_id: gitHubInstallationId });

		const { data: { login } } = useNewGitHubClient ?
			await gitHubUserClient.getUser() :
			await github.users.getAuthenticated();

		// Only show the page if the logged in user is an admin of this installation
		if (!await isUserAdminOfOrganization(
			gitHubUserClient,
			installation.account.login,
			login,
			installation.target_type
		)) {
			res.status(401).json({ err: `Unauthorized access to delete subscription.` });
			return;
		}
		try {
			const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId);
			if (!subscription) {
				res.status(404).send("Cannot find Subscription.");
				return;
			}
			await subscription.destroy();
			res.sendStatus(202);
		} catch (err) {
			res.status(403).json({ err: `Failed to delete subscription.` });
		}

	} catch (err) {
		logger.error({ err, req, res }, "Error while processing delete subscription request");
		res.sendStatus(500);
	}
};
