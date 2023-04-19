import { Request, Response } from "express";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import sanitizeHtml from "sanitize-html";

export const GithubBranchesGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost, gitHubAppConfig } = res.locals;
	const logger = getLogger("github-branches-get", {
		fields: req.log?.fields
	});

	if (!gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const { owner, repo } = req.params;
	if (!owner || !repo) {
		logger.warn("Missing required data.");
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost);
		if (!subscription) {
			logger.error("No Subscription found!");
			throw Error("No Subscription found!");
		}

		const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-branches-get" }, req.log, gitHubAppConfig.gitHubAppId);
		const [ branches, repository ] = await Promise.all([
			gitHubInstallationClient.getReferences(owner, repo),
			gitHubInstallationClient.getRepositoryByOwnerRepo(owner, repo)
		]);

		res.send({
			branches: branches.data.filter(branch => branch.name !== repository.data.default_branch).map(branch => ({
				...branch,
				name: sanitizeHtml(branch.name)
			})),
			defaultBranch: sanitizeHtml(repository.data.default_branch)
		});
	} catch (err) {
		logger.error({ err }, "Error while fetching branches");
		res.sendStatus(500);
	}
};
