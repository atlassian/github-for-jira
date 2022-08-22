import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { createAppClient, createUserClient } from "~/src/util/get-github-client-config";
import { GitHubServerApp } from "~/src/models/github-server-app";

export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;
	const gitHubInstallationId = Number(req.params.installationId);
	const gitHubApp = await GitHubServerApp.findForUuid(req.params.uuid);
	const logger = req.log.child({ jiraHost, gitHubInstallationId });

	if (gitHubApp?.id !== gitHubAppConfig?.gitHubAppId) {
		logger.debug("GitHub app IDs do not match. Cannot GET subscription");
		throw new Error("Cannot GET subscription.");
	}

	const gitHubAppId = gitHubApp?.id;
	const gitHubAppUuid = gitHubApp?.uuid;

	logger.debug("Received GitHub manage subscriptions request");

	if (!githubToken) {
		logger.debug("No GitHub token found.");
		return next(new Error("Unauthorized"));
	}

	if (!gitHubInstallationId || !jiraHost) {
		logger.debug("Missing Jira host and/or GitHub installation id.");
		return next(new Error("installationId and jiraHost must be provided to delete a subscription."));
	}
	const gitHubAppClient = await createAppClient(logger, jiraHost, gitHubAppId);
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
	try {
		const { data: { login } } = await gitHubUserClient.getUser();

		// get the installation to see if the user is an admin of it
		const { data: installation } = await gitHubAppClient.getInstallation(gitHubInstallationId);

		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId, gitHubAppId);

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
				hasSubscriptions: subscriptions.length > 0,
				gitHubAppUuid
			});
		} else {
			return next(new Error("Unauthorized"));
		}
	} catch (err) {
		logger.error(err, "Unable to show subscription page");
		return next(new Error("Unable to show subscription page"));
	}
};
