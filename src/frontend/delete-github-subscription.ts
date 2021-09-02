import { ActionFromSubscription, ActionSource, ActionType } from "../proto/v0/action";
import { submitProto } from "../tracking";
import { Installation, Subscription } from "../models";
import { Request, Response } from "express";

/**
 * Handle the when a user adds a repo to this installation
 */
export default async (req: Request, res: Response): Promise<void> => {
	if (!req.session.githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!req.body.installationId || !req.body.jiraHost) {
		res.status(400)
			.json({
				err: "installationId and jiraHost must be provided to delete a subscription."
			});
		return;
	}

	req.log.info("Received delete-subscription request");

	/**
	 * Returns the role of the user for an Org or 'admin' if the
	 * installation belongs to the current user
	 */
	async function getRole({ login, installation }) {
		if (installation.target_type === "Organization") {
			const { data: { role } } = await res.locals.github.orgs.getMembership({
				org: installation.account.login,
				username: login
			});
			return role;
		} else if (installation.target_type === "User") {
			return (login === installation.account.login) ? "admin" : "";
		}
		throw new Error(`unknown "target_type" on installation id ${req.body.installationId}.`);
	}

	// Check if the user that posted this has access to the installation ID they're requesting
	try {
		const { data: { installations } } = await res.locals.github.apps.listInstallationsForAuthenticatedUser();

		const userInstallation = installations.find(installation => installation.id === Number(req.body.installationId));

		if (!userInstallation) {
			res.status(401)
				.json({
					err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`
				});
			return;
		}
		const { data: { login } } = await res.locals.github.users.getAuthenticated();

		// If the installation is an Org, the user needs to be an admin for that Org
		try {
			const role = await getRole({ login, installation: userInstallation });
			if (role !== "admin") {
				res.status(401)
					.json({
						err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`
					});
				return;
			}

			const subscription = await Subscription.getSingleInstallation(req.body.jiraHost, req.body.installationId);
			const installation = await Installation.getForHost(req.body.jiraHost);
			const action = ActionFromSubscription(subscription, installation);
			action.type = ActionType.DESTROYED;
			action.actionSource = ActionSource.WEB_CONSOLE;

			await subscription.destroy();
			await submitProto(action);
			res.sendStatus(202);
		} catch (err) {
			res.status(403)
				.json({
					err: `Failed to delete subscription to ${req.body.installationId}. ${err}`
				});
		}
	} catch (err) {
		req.log.error({ err, req, res }, "Error while processing delete subscription request");
		res.sendStatus(500);
	}
};
