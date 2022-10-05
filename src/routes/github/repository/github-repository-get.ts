import { Request, Response } from "express";
import { createAppClient } from "utils/get-github-client-config";

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
		const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppConfig.gitHubAppId);
		const installations = await gitHubAppClient.getInstallations();
		const orgString = installations.data?.map(installation => ` org:${installation.account.login}`).join(" ");
		const searchedRepos = await gitHubAppClient.searchUserRepositoriesRest(`${repoName} ${orgString}`);
		res.send({
			repositories: searchedRepos.data?.items
		});
	} catch (err) {
		req.log.error({ err }, "Error searching repository");
		res.sendStatus(500);
	}
};
