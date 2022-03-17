import { Request, Response } from "express";
import { GitHubAPI } from "probot";
import { Subscription } from "../../../models";
import { getCloudInstallationId } from "../../../github/client/installation-id";
import { GitHubAppClient } from "../../../github/client/github-app-client";
import { GitHubUserClient } from "../../../github/client/github-user-client";
import { booleanFlag, BooleanFlags } from "../../../config/feature-flags";

const hasDeleteAccess = async (gitHubUserClient: GitHubUserClient | GitHubAPI, installation): Promise<boolean> => {
	const { data: { role, user: { login } } } = gitHubUserClient instanceof GitHubUserClient ?
		await gitHubUserClient.getMembership(installation.account.login) :
		await gitHubUserClient.orgs.getMembershipForAuthenticatedUser({ org: installation.account.login });

	if (installation.type === "User") {
		return installation.account.login === login;
	}
	return role === "admin";
};

export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
	const { github, client, githubToken, jiraHost } = res.locals;
	const { installationId } = req.body;

	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DELETE_SUBSCRIPTION, false, jiraHost) ;
	const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(installationId), req.log);
	const gitHubUserClient = new GitHubUserClient(githubToken, req.log);

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!installationId || !jiraHost) {
		res.status(400).json({ err: "installationId and jiraHost must be provided to delete a subscription." });
		return;
	}

	req.log.info("Received delete-subscription request");

	try {
		const { data: installation } = useNewGitHubClient ?
			await gitHubAppClient.getInstallation(installationId) :
			await client.apps.getInstallation({ installation_id: installationId });

		if (!await hasDeleteAccess(useNewGitHubClient ? gitHubUserClient : github, installation)) {
			res.status(401).json({ err: `Unauthorized access to delete subscription.` });
			return;
		}

		try {
			const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
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
		req.log.error({ err, req, res }, "Error while processing delete subscription request");
		res.sendStatus(500);
	}
};