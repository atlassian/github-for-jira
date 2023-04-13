import { Request, Response } from "express";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { Subscription } from "models/subscription";

export const GithubBranchesGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, gitHubAppConfig } = res.locals;

	if (!gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const { owner, repo } = req.params;
	if (!owner || !repo) {
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost);
		if (!subscription) {
			throw Error("nah no deal");
		}

		const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-branches-get" }, req.log, gitHubAppConfig.gitHubAppId);
		const [ branches, repository ] = await Promise.all([
			gitHubInstallationClient.getReferences(owner, repo),
			gitHubInstallationClient.getRepositoryByOwnerRepo(owner, repo)
		]);

		res.send({
			branches: branches.data.filter(branch => branch.name !== repository.data.default_branch),
			defaultBranch: repository.data.default_branch
		});
	} catch (err) {
		req.log.error({ err }, "Error while fetching branches");
		res.sendStatus(500);
	}
};
