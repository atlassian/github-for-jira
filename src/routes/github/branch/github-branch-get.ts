import { Request, Response } from "express";
import { createUserClient } from "utils/get-github-client-config";

// Get a branch for the **USER TOKEN**
export const GithubBranchGet = async (req: Request, res: Response): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;
	const { owner, repo, ref } = req.params;

	if (!githubToken || !gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
	try {
		await gitHubUserClient.getReference(owner, repo, ref);
		res.status(200).send();
	} catch (err) {
		if (err.status === 404) {
			res.status(404).send();
			return;
		}
		res.status(500).json(err);
	}

};
