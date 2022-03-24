import { Subscription } from "models/models";
import { getHashedKey } from "models/installation";
import { Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";

/**
 * Handle the when a user adds a repo to this installation
 */
export const GithubConfigurationPost = async (req: Request, res: Response): Promise<void> => {
	const { github, client, githubToken, jiraHost } = res.locals;

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}
	const installationId = Number(req.body.installationId);

	if (!installationId) {
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	if (!req.body.clientKey) {
		res.status(400)
			.json({
				err: "A clientKey must be provided to link an installation."
			});
		return;
	}

	req.addLogFields({ installationId });
	req.log.info("Received add subscription request");

	// Check if the user that posted this has access to the installation ID they're requesting
	try {
		const installation = await client.apps.getInstallation({ installation_id: installationId })
			.then(r => r.data, () => undefined);

		if (!installation) {
			res.status(404)
				.json({
					err: `Installation with id ${installationId} doesn't exist.`
				});
			return;
		}

		// If the installation is an Org, the user needs to be an admin for that Org
		if (installation.target_type === "Organization") {
			const { data: { login } } = await github.users.getAuthenticated();
			const { data: { role } } = await github.orgs.getMembership({
				org: installation.account.login,
				username: login
			});

			if (role !== "admin") {
				res.status(401)
					.json({
						err: `Failed to add subscription to ${installationId}. User is not an admin of that installation`
					});
				return;
			}
		}

		const subscription = await Subscription.install({
			clientKey: getHashedKey(req.body.clientKey),
			installationId,
			host: jiraHost
		});

		await findOrStartSync(subscription, req.log);

		res.sendStatus(200);
	} catch (err) {
		req.log.error(err, "Error processing subscription add request");
		res.sendStatus(500);
	}
};
