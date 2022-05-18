import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import {getGitHubBaseUrl} from "utils/check-github-app-type";

export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { github, client, githubToken, jiraHost } = res.locals;

	const gitHubInstallationId = Number(req.params.installationId);
	if (!githubToken) {
		return next(new Error("Unauthorized"));
	}

	if (!gitHubInstallationId || !jiraHost) {
		return next(new Error("installationId and jiraHost must be provided to delete a subscription."));
	}

	const logger = req.log.child({ jiraHost, gitHubInstallationId });
	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GET_SUBSCRIPTION, true, jiraHost);
	const gitHubAppClient = new GitHubAppClient(jiraHost, logger);
	const gitHubBaseUrl = await getGitHubBaseUrl(jiraHost);
	const gitHubUserClient = new GitHubUserClient(githubToken, gitHubBaseUrl, req.log);

	try {
		const { data: { login } } = useNewGitHubClient ? await gitHubUserClient.getUser() : await github.users.getAuthenticated();

		// get the installation to see if the user is an admin of it
		const { data: installation } = useNewGitHubClient ?
			await gitHubAppClient.getInstallation(gitHubInstallationId) :
			await client.apps.getInstallation({ installation_id: gitHubInstallationId });

		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId);

		// Only show the page if the logged in user is an admin of this installation
		if (await isUserAdminOfOrganization(
			new GitHubUserClient(githubToken, gitHubBaseUrl, req.log),
			installation.account.login,
			login,
			installation.target_type
		)) {
			return res.render("github-subscriptions.hbs", {
				csrfToken: req.csrfToken(),
				nonce: res.locals.nonce,
				installation,
				host: res.locals.jiraHost,
				subscriptions,
				hasSubscriptions: subscriptions.length > 0
			});
		} else {
			return next(new Error("Unauthorized"));
		}
	} catch (err) {
		logger.error(err, "Unable to show subscription page");
		return next(new Error("Unable to show subscription page"));
	}
};
