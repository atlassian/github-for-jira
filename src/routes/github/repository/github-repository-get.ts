import { Request, Response } from "express";
import { createUserClient } from "utils/get-github-client-config";

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;
	const { repoName } = req.query;

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!repoName) {
		res.send(400);
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
		const searchedRepos = await gitHubUserClient.searchUserRepositories(repoName as string);
		res.send({
			repositories: searchedRepos.search.repos
		});
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};
