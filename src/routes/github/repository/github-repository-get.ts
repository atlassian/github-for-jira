import Logger from "bunyan";
import { Request, Response } from "express";
import { createAppClient, createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { RepositoryNode } from "~/src/github/client/github-queries";
import { Subscription } from "~/src/models/subscription";
const MAX_REPOS_RETURNED = 20;

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;
	const repoName = req.query?.repoName as string;

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!repoName) {
		res.send(400);
		return;
	}

	try {
		const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppConfig.gitHubAppId || null);
		const reposInstallation = await getReposBySubscriptions(repoName, subscriptions, jiraHost, githubToken, req.log);
		res.send({
			repositories: reposInstallation
		});
	} catch (err) {
		req.log.error({ err }, "Error searching repository");
		res.sendStatus(500);
	}
};

const getReposBySubscriptions = async (repoName: string, subscriptions: Subscription[], jiraHost: string, githubToken:string, logger: Logger): Promise<RepositoryNode[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		try {
			// TODO - promise all these 4 - orgname username iclient uclient
			const orgName = await getOrgName(subscription, jiraHost, logger);
			const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, logger, subscription.gitHubAppId);
			const gitHubUserClient = await createUserClient(githubToken, jiraHost, logger, subscription.gitHubAppId);

			const gitHubUser = (await gitHubUserClient.getUser()).data.login;
			const searchQueryInstallationString = `${repoName} org:${orgName} in:name`;
			const searchQueryUserString = `${repoName} org:${orgName} org:${gitHubUser} in:name`;
			// TODO jk PROMISE ALL THESE CALLS
			const responseInstallationSearch = await gitHubInstallationClient.searchRepositories(searchQueryInstallationString);
			const responseUserSearch = await gitHubUserClient.searchRepositories(searchQueryUserString);

			const userClientSearch =  responseUserSearch.data?.items || [];
			const userInstallationSearch = responseInstallationSearch.data?.items || [];
			return [...userClientSearch, ...userInstallationSearch];
		} catch (err) {
			logger.error("Create branch - Failed to search repos for installation");
			throw err;
		}
	});
	const repos = (await Promise.all(repoTasks))
		.flat()
		.sort(sortByScoreAndUpdatedAt);
	return repos.slice(0, MAX_REPOS_RETURNED);
};

const sortByScoreAndUpdatedAt = (a, b) => {
	if (a.score != b.score) {
		return a.score - b.score;
	}
	return new Date(b.updated_at).valueOf() - new Date(a.updated_at).valueOf();
};

const getOrgName = async (subscription: Subscription, jiraHost: string, logger: Logger) => {
	const gitHubAppClient = await createAppClient(logger, jiraHost, subscription.gitHubAppId);
	const response = await gitHubAppClient.getInstallation(subscription.gitHubInstallationId);
	return response.data?.account?.login;
};
