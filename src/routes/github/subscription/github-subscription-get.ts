import { NextFunction, Request, Response } from "express";
import { Subscription } from "models/index";
import { getCloudInstallationId } from "../../../github/client/installation-id";
import { GitHubAppClient } from "../../../github/client/github-app-client";
import { GitHubUserClient } from "../../../github/client/github-user-client";
import { booleanFlag, BooleanFlags } from "../../../config/feature-flags";

export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

	const { github, client, isAdmin, githubToken, jiraHost } = res.locals;
	const gitHubInstallationId = Number(req.params.installationId);

	if (!githubToken) {
		return next(new Error("Unauthorized"));
	}

	if (!gitHubInstallationId || !jiraHost) {
		return next(new Error("installationId and jiraHost must be provided to delete a subscription."));
	}

	const logger = req.log.child({ jiraHost, gitHubInstallationId });
	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GET_SUBSCRIPTION, false, jiraHost);
	const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(gitHubInstallationId), logger);
	const gitHubUserClient = new GitHubUserClient(githubToken, logger);

	try {
		const { data: { login } } = useNewGitHubClient ? await gitHubUserClient.getUser() : await github.users.getAuthenticated();

		// get the installation to see if the user is an admin of it
		const { data: installation } = useNewGitHubClient ?
			await gitHubAppClient.getInstallation(gitHubInstallationId) :
			await client.apps.getInstallation({ installation_id: gitHubInstallationId });

		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId);

		// Only show the page if the logged in user is an admin of this installation
		if (!await isAdmin({
			org: installation.account.login,
			username: login,
			type: installation.target_type
		})) {
			return next(new Error("Unauthorized"));
		}

		const { data: info } = useNewGitHubClient ? await gitHubAppClient.getInstallations() : await client.apps.getAuthenticated();
		return res.render("github-subscriptions.hbs", {
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			installation,
			info,
			host: res.locals.jiraHost,
			subscriptions,
			hasSubscriptions: subscriptions.length > 0
		});
	} catch (err) {
		logger.error(err, "Unable to show subscription page");
		return next(new Error("Unable to show subscription page"));
	}
};