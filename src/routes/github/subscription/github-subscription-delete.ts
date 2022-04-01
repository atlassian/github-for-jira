import { Request, Response } from "express";
import { GitHubAPI, Octokit } from "probot";
import { Subscription } from "models/subscription";
import { getCloudInstallationId } from "../../../github/client/installation-id";
import { GitHubAppClient } from "../../../github/client/github-app-client";
import { GitHubUserClient } from "../../../github/client/github-user-client";
import { booleanFlag, BooleanFlags } from "../../../config/feature-flags";

// todo use isadmin github util
const hasDeleteRights = async (gitHubUserClient: GitHubUserClient | GitHubAPI, installation: Octokit.AppsGetInstallationResponse): Promise<boolean> => {
	const { data: { role, user: { login } } } = gitHubUserClient instanceof GitHubUserClient ?
		await gitHubUserClient.getMembershipForOrg(installation.account.login) :
		await gitHubUserClient.orgs.getMembershipForAuthenticatedUser({ org: installation.account.login });

	if (installation.target_type === "User") {
		return installation.account.login === login;
	}
	return role === "admin";
};

export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
	const { github, client, githubToken, jiraHost } = res.locals;
	const { installationId: gitHubInstallationId } = req.body;
	const logger = req.log.child({ jiraHost, gitHubInstallationId });

	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DELETE_SUBSCRIPTION, false, jiraHost) ;
	const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(gitHubInstallationId), logger);
	const gitHubUserClient = new GitHubUserClient(githubToken, logger);

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
		const { data: installation } = useNewGitHubClient ?
			await gitHubAppClient.getInstallation(gitHubInstallationId) :
			await client.apps.getInstallation({ installation_id: gitHubInstallationId });

		if (!await hasDeleteRights(useNewGitHubClient ? gitHubUserClient : github, installation)) {
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