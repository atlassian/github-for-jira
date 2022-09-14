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
		const gitHubUserDetails = await gitHubUserClient.getUserOrganizations();
		const usersOwnOrg = gitHubUserDetails.viewer.login;
		const remainingOrgs = gitHubUserDetails.viewer.organizations.nodes.map(org => ` org:${org.login}`);
		const gitHubSearchQueryString = `${repoName} org:${usersOwnOrg}${remainingOrgs} in:name sort:updated-desc`;
		const searchedRepos = await gitHubUserClient.searchUserRepositories(gitHubSearchQueryString);
		res.send({
			repositories: searchedRepos.search.repos
		});
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};
