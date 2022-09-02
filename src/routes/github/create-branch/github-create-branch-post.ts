import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;
	const { owner, repo, sourceBranchName, newBranchName } = req.body;

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		// TODO - pass in the gitHubAppId when we start supporting GHES, instead of undefined
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, undefined);
		const { data: baseBranchRef } = await gitHubUserClient.getReference(owner, repo, sourceBranchName);
		const sha = baseBranchRef.object.sha;

		await gitHubUserClient.createBranch(owner, repo, {
			owner,
			repo,
			ref: `refs/heads/${newBranchName}`,
			sha
		});
		res.sendStatus(200);
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};
