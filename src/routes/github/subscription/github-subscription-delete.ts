import { Subscription } from "../../../models";
import { Request, Response } from "express";
// import { GitHubAppClient } from "../../../github/client/github-app-client";
// import { getCloudInstallationId } from "../../../github/client/installation-id";
// import { GitHubUserClient } from "../../../github/client/github-user-client";
// import { GitHubAPI } from "probot";

// const hasDeleteAccess = async (gitHubUserClient: GitHubUserClient | GitHubAPI, installation): Promise<boolean> => {
// 	const { data: { role, user: login } } = gitHubUserClient instanceof GitHubUserClient ?
// 		await gitHubUserClient.getMembership(installation.account.login) :
// 		await gitHubUserClient.getMembership({ org: installation.account.login });

// 	if (type === "User") {
// 		return org === login;
// 	}
// 	return role === "admin";
// }

export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
	const { github, githubToken, jiraHost } = res.locals;
	const { installationId } = req.body;
	console.error(github);
	// TODO this cant be checked as middlewares
	if (!githubToken) {
		res.sendStatus(401); // can this be moved to middle ware
		return;
	}

	// TODO this cant be checked as middlewares
	if (!installationId || !jiraHost) {
		res.status(400)
			.json({ err: "installationId and jiraHost must be provided to delete a subscription." });
		return;
	}

	req.log.info("Received delete-subscription request");

	// Check if the user that posted this has access to the installation ID they're requesting
	try {
		// const useNewGitHubClient = true;
		// const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(installationId), req.log);
		// const gitHubUserClient = new GitHubUserClient(githubToken);
		// const { data: installation } = useNewGitHubClient ?
		// 	await github.apps.getInstallation({ installation_id: installationId }) :
		// 	await gitHubAppClient.getInstallation(installationId);

		// if (!await hasDeleteAccess(useNewGitHubClient ? gitHubUserClient : github.orgs, installation)) {
		// 	res.status(401)
		// 		.json({ err: `Failed to delete subscription for ${installationId}. User does not have access to that installation.` });
		// 	return;
		// }
		try {
			const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
			if (!subscription) {
				req.log.warn({ req, res }, "Cannot find Subscription");
				res.status(404).send("Cannot find Subscription.");
				return;
			}
			await subscription.destroy();
			res.sendStatus(202);
		} catch (err) {
			res.status(403)
				.json({
					err: `Failed to delete subscription to ${installationId}. ${err}`
				});
		}
	} catch (err) {
		req.log.error({ err, req, res }, "Error while processing delete subscription request");
		res.sendStatus(500);
	}
};



// import { Subscription } from "../../../models";
// import { Request, Response } from "express";

// export const GithubSubscriptionDelete = async (req: Request, res: Response): Promise<void> => {
// 	const { github, githubToken, jiraHost } = res.locals;
// 	if (!githubToken) {
// 		res.sendStatus(401);
// 		return;
// 	}

// 	if (!req.body.installationId || !jiraHost) {
// 		res.status(400)
// 			.json({
// 				err: "installationId and jiraHost must be provided to delete a subscription."
// 			});
// 		return;
// 	}

// 	req.log.info("Received delete-subscription request");

// 	/**
// 	 * Returns the role of the user for an Org or 'admin' if the
// 	 * installation belongs to the current user
// 	 */
// 	async function getRole({ login, installation }) {
// 		if (installation.target_type === "Organization") {
// 			const { data: { role } } = await github.orgs.getMembership({
// 				org: installation.account.login,
// 				username: login
// 			});
// 			return role;
// 		} else if (installation.target_type === "User") {
// 			return (login === installation.account.login) ? "admin" : "";
// 		}
// 		throw new Error(`unknown "target_type" on installation id ${req.body.installationId}.`);
// 	}

// 	// Check if the user that posted this has access to the installation ID they're requesting
// 	try {
// 		const { data: { installations } } = await github.apps.listInstallationsForAuthenticatedUser();

// 		const userInstallation = installations.find(installation => installation.id === Number(req.body.installationId));

// 		if (!userInstallation) {
// 			res.status(401)
// 				.json({
// 					err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`
// 				});
// 			return;
// 		}
// 		const { data: { login } } = await github.users.getAuthenticated();

// 		// If the installation is an Org, the user needs to be an admin for that Org
// 		try {
// 			const role = await getRole({ login, installation: userInstallation });
// 			if (role !== "admin") {
// 				res.status(401)
// 					.json({
// 						err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`
// 					});
// 				return;
// 			}

// 			const subscription = await Subscription.getSingleInstallation(res.locals.jiraHost, req.body.installationId);
// 			if (!subscription) {
// 				req.log.warn({ req, res }, "Cannot find Subscription");
// 				res.status(404).send("Cannot find Subscription.");
// 				return;
// 			}
// 			await subscription.destroy();
// 			res.sendStatus(202);
// 		} catch (err) {
// 			res.status(403)
// 				.json({
// 					err: `Failed to delete subscription to ${req.body.installationId}. ${err}`
// 				});
// 		}
// 	} catch (err) {
// 		req.log.error({ err, req, res }, "Error while processing delete subscription request");
// 		res.sendStatus(500);
// 	}
// };
