import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

export const GithubBranchesGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;

	if (!githubToken || !gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const { owner, repo } = req.params;
	if (!owner || !repo) {
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
		const [ branches, repository ] = await Promise.all([
			gitHubUserClient.getReferences(owner, repo),
			gitHubUserClient.getRepository(owner, repo)
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
