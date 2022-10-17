import { Request, Response } from "express";
import { createAppClient, createUserClient } from "utils/get-github-client-config";

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
		const gitHubUserDetails = await gitHubUserClient.getUserOrganizations();
		const userAccount = gitHubUserDetails.viewer.login;
		const userOrgs = gitHubUserDetails.viewer.organizations.nodes.map(org => ` org:${org.login}`);
		const gitHubSearchQueryString = `${repoName} org:${userAccount}${userOrgs} in:name`;

		const gitHubAppClient = await createAppClient(req.log, jiraHost, gitHubAppConfig.gitHubAppId);

		const searchedRepos = await gitHubAppClient.searchRepositories(gitHubSearchQueryString);

		res.send({
			repositories: searchedRepos.data?.items
		});
	} catch (err) {
		req.log.error({ err }, "Error searching repository");
		res.sendStatus(500);
	}
};
