import { Subscription } from "../models";
import { getHashedKey } from "../models/installation";
import { Request, Response } from "express";
import { findOrStartSync } from "../sync/sync-utils";

/**
 * Handle the when a user adds a repo to this installation
 */
export default async (req: Request, res: Response): Promise<void> => {
	const {github, githubToken, jiraHost } = res.locals;

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	if (!req.body.installationId) {
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation and a Jira host."
			});
		return;
	}

	req.log.info({ installationId: req.body.installationId }, "Received add subscription request");

	// Check if the user that posted this has access to the installation ID they're requesting
	try {
		const { data: { installations } } = await github.apps.listInstallationsForAuthenticatedUser();

		const userInstallation = installations.find(installation => installation.id === Number(req.body.installationId));

		if (!userInstallation) {
			res.status(401)
				.json({
					err: `Failed to add subscription to ${req.body.installationId}. User does not have access to that installation.`
				});
			return;
		}

		// If the installation is an Org, the user needs to be an admin for that Org
		if (userInstallation.target_type === "Organization") {
			const { data: { login } } = await github.users.getAuthenticated();
			const { data: { role } } = await github.orgs.getMembership({
				org: userInstallation.account.login,
				username: login
			});

			if (role !== "admin") {
				res.status(401)
					.json({
						err: `Failed to add subscription to ${req.body.installationId}. User is not an admin of that installation`
					});
				return;
			}
		}

		const subscription = await Subscription.install({
			clientKey: getHashedKey(req.body.clientKey),
			installationId: req.body.installationId,
			host: jiraHost
		});

		console.log('VERSION 2 - post config');
		console.log(req.body);
		console.log('VERSION 2 - post config part 2');
		console.log(userInstallation.account.login);
		const syncType = "full";

		await findOrStartSync(subscription, req.log, syncType);

		res.sendStatus(200);
	} catch (err) {
		req.log.error(err, "Error processing subscription add request");
		res.sendStatus(500);
	}
};
