import { Request, Response } from "express";
import { createUserClient } from "utils/get-github-client-config";

export const GithubValidateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, branchName } = req.body;

	if (!branchName || !owner || !repo) {
		res.status(400).json("WORKED AS");
		return;
	}

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	try {
		await gitHubUserClient.getReference(owner, repo, branchName);
		res.status(200);
	} catch (err) {
		res.status(404).json("Branch not found");
	}

};

