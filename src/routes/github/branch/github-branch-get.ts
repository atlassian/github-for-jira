import { Request, Response } from "express";
import { createInstallationClient } from "utils/get-github-client-config";
import { Subscription } from "models/subscription";

export const GithubBranchGet = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, ref } = req.params;

	if (!gitHubAppConfig) {
		req.log.warn("No gitHubAppConfig found.");
		res.sendStatus(401);
		return;
	}

	const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost);
	if (!subscription) {
		req.log.warn("No Subscription found.");
		return;
	}

	try {
		const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-branch-get" }, req.log, gitHubAppConfig.gitHubAppId);
		await gitHubInstallationClient.getReference(owner, repo, ref);
		res.sendStatus(200);
	} catch (err) {
		if (err.status === 404) {
			req.log.error("Branch not found.");
			res.sendStatus(404);
			return;
		}
		req.log.error("Error retrieving branch.");
		res.status(500).json(err);
	}

};
