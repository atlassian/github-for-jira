import { Request, Response } from "express";
import { createUserClient } from "utils/get-github-client-config";

// Get a branch for the **USER**
export const GithubBranchGet = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, ref } = req.params;

	if (!ref || !owner || !repo) {
		res.status(400).json("Missing required fields.");
		return;
	}

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	try {
		await gitHubUserClient.getReference(owner, repo, ref);
		res.status(200);
	} catch (err) {
		if (err.status === 404) {
			res.status(404).json("Branch not found");
		}
		res.status(500).json(err);
	}

};
