import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { createAppClient, createUserClient } from "~/src/util/get-github-client-config";

export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;

	const gitHubInstallationId = Number(req.params.installationId);
	if (!githubToken) {
		return next(new Error("Unauthorized"));
	}

	if (!gitHubInstallationId || !jiraHost) {
		return next(new Error("installationId and jiraHost must be provided to delete a subscription."));
	}

	const logger = req.log.child({ jiraHost, gitHubInstallationId });
	const gitHubAppClient = await createAppClient(gitHubInstallationId, logger, jiraHost);
	const gitHubUserClient = await createUserClient(gitHubInstallationId, githubToken, req.log, jiraHost);

	try {
		const { data: { login } } = await gitHubUserClient.getUser();

		// get the installation to see if the user is an admin of it
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);

		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForGitHubInstallationId(gitHubInstallationId);

		// Only show the page if the logged in user is an admin of this installation
		if (await isUserAdminOfOrganization(
			gitHubUserClient,
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
