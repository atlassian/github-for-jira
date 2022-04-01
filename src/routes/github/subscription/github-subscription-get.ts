import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { GitHubUserClient } from "~/src/github/client/github-user-client";

export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { github, client, githubToken } = res.locals;
	if (!githubToken) {
		return next(new Error("Unauthorized"));
	}

	const installationId = Number(req.params.installationId);

	try {
		const { data: { login } } = await github.users.getAuthenticated();
		// get the installation to see if the user is an admin of it
		const { data: installation } = await client.apps.getInstallation({ installation_id: installationId });
		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForInstallation(installationId);

		// Only show the page if the logged in user is an admin of this installation
		if (await isUserAdminOfOrganization(
			new GitHubUserClient(githubToken, req.log),
			installation.account.login,
			login,
			installation.target_type
		)) {
			const { data: info } = await client.apps.getAuthenticated();

			return res.render("github-subscriptions.hbs", {
				csrfToken: req.csrfToken(),
				nonce: res.locals.nonce,
				installation,
				info,
				host: res.locals.jiraHost,
				subscriptions,
				hasSubscriptions: subscriptions.length > 0
			});
		} else {
			return next(new Error("Unauthorized"));
		}
	} catch (err) {
		req.log.error(err, "Unable to show subscription page");
		return next(new Error("Not Found"));
	}
};
