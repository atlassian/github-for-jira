import { Request, Response } from "express";
import { createInstallationClient } from "utils/get-github-client-config";
import { Subscription } from "models/subscription";

// Get a branch for the **USER TOKEN**
export const GithubBranchGet = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, ref } = req.params;

	if (!gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost);
	if (!subscription) {
		return;
	}

	const gitHubInstallationClient = await createInstallationClient(subscription?.gitHubInstallationId, jiraHost, { trigger: "github-branch-get" }, req.log, gitHubAppConfig.gitHubAppId);
	// const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "github-branch-get" }, req.log, gitHubAppConfig.gitHubAppId);
	try {
		await gitHubInstallationClient.getReference(owner, repo, ref);
		res.sendStatus(200);
	} catch (err) {
		if (err.status === 404) {
			res.sendStatus(404);
			return;
		}
		res.status(500).json(err);
	}

};
