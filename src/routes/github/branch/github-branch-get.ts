import { Request, Response } from "express";
import { createInstallationClient } from "utils/get-github-client-config";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { Errors } from "config/errors";

export const GithubBranchGet = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, ref } = req.params;

	const logger = getLogger("github-branch-get", {
		fields: req.log?.fields
	});

	if (!gitHubAppConfig) {
		logger.error(Errors.MISSING_GITHUB_APP_CONFIG);
		res.sendStatus(401);
		return;
	}

	const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost, !!gitHubAppConfig.gitHubAppId);
	if (!subscription) {
		logger.error(Errors.MISSING_SUBSCRIPTION);
		res.sendStatus(400);
		return;
	}

	try {
		const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-branch-get" }, req.log, gitHubAppConfig.gitHubAppId);
		await gitHubInstallationClient.getReference(owner, repo, ref);
		res.sendStatus(200);
	} catch (e: unknown) {
		const err = e as { status?: number };
		if (err.status === 404) {
			logger.error("Branch not found.");
			res.sendStatus(404);
			return;
		}
		logger.error("Error retrieving branch.");
		res.status(500).json(err);
	}

};
