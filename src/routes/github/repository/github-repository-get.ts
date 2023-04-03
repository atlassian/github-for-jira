import Logger from "bunyan";
import { Request, Response } from "express";
import { createAppClient, createInstallationClient, createUserClient } from "utils/get-github-client-config";
import { RepositoryNode } from "~/src/github/client/github-queries";
import { Subscription } from "~/src/models/subscription";
import { sendError } from "~/src/jira/util/jwt";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
const MAX_REPOS_RETURNED = 20;

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost: jiraHostLocals, gitHubAppConfig } = res.locals;
	const { jiraHost: jiraHostParam } = req.query;
	const repoName = req.query?.repoName as string;
	const jiraHost = jiraHostLocals || jiraHostParam;

	const log = req.log.child({ jiraHost });

	if (!jiraHost) {
		log.error("Unauthorised - No JiraHost found");
		sendError(res, 401, "Unauthorised");
		return;
	}

	if (!githubToken) {
		log.error("Unauthorised - No githubToken found");
		res.sendStatus(401);
		return;
	}

	if (!repoName) {
		log.error("No repoName found");
		res.send(400);
		return;
	}

	try {
		const repositories = await searchInstallationAndUserRepos(repoName, jiraHost, gitHubAppConfig.gitHubAppId || null, githubToken, log);
		res.send({
			repositories
		});
	} catch (err) {
		log.error({ err }, "Error fetching repositories");
		res.status(500).send({
			repositories: []
		});
	}
};

export const searchInstallationAndUserRepos = async (repoName, jiraHost, gitHubAppId, githubToken, logger) => {
	try {
		const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppId);
		const repos = await getReposBySubscriptions(repoName, subscriptions, jiraHost, githubToken, logger);
		return repos || [];
	} catch (err) {
		logger.log.error({ err }, "Failed to get repos for subscription");
		return [];
	}
};

const getReposBySubscriptions = async (repoName: string, subscriptions: Subscription[], jiraHost: string, githubToken:string, logger: Logger): Promise<RepositoryNode[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		try {
			const metrics = { trigger: "github-repo-get" };
			const [orgName, gitHubInstallationClient, gitHubUserClient] = await Promise.all([
				getOrgName(subscription, jiraHost, logger).then(orgName => {
					logger.info({ orgName }, "Found orgName");
					return orgName;
				}),
				createInstallationClient(subscription.gitHubInstallationId, jiraHost, metrics, logger, subscription.gitHubAppId),
				createUserClient(githubToken, jiraHost, metrics, logger, subscription.gitHubAppId)
			]);

			const verboseLoggingEnabled = await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost);

			const gitHubUser = (await gitHubUserClient.getUser()).data.login;
			const searchQueryInstallationString = `${repoName} org:${orgName} in:name`;
			const searchQueryUserString = `${repoName} org:${orgName} org:${gitHubUser} in:name`;

			const [userInstallationSearch, userClientSearch] = await Promise.all([

				gitHubInstallationClient.searchRepositories(searchQueryInstallationString, "updated")
					.then(responseInstallationSearch => {
						const userInstallationSearch = responseInstallationSearch.data?.items || [];
						logger.info(`Found ${userInstallationSearch.length} repos from installation search`);
						return userInstallationSearch;
					})
					// When no enough perms, API might throw errors. We don't want that to stop the routine because there might
					// be other orgs connected where the customer has enough perms
					// https://docs.github.com/en/rest/search?apiVersion=2022-11-28#access-errors-or-missing-search-results
					.catch(err => {
						logger.warn({ err },"Cannot search for repos using installation client, falling back to empty array");
						return [];
					}),

				gitHubUserClient.searchRepositories(searchQueryUserString, "updated")
					.then(responseUserSearch => {
						const userClientSearch = responseUserSearch.data?.items || [];
						logger.info(`Found ${userClientSearch.length} repos from user client search`);
						return responseUserSearch.data?.items || [];
					})
					.catch(err => {
						logger.warn({ err }, "Cannot search for repos using user client, falling back to empty array");
						// Troubleshooting https://github.com/atlassian/github-for-jira/issues/1845
						if (verboseLoggingEnabled) {
							logger.warn({
								unsafe: true,
								err,
								searchQueryUserString
							}, "Cannot search for repos using user client, falling back to empty array");
						}
						return [];
					})
			]);

			const repos = getIntersectingRepos(userInstallationSearch, userClientSearch);

			return repos;
		} catch (err) {
			logger.error({ err }, "Create branch - Failed to search repos for installation");
			throw err;
		}
	});
	const repos = (await Promise.all(repoTasks))
		.flat()
		.sort(sortByScoreAndUpdatedAt);
	return repos.slice(0, MAX_REPOS_RETURNED);
};

// We want repos that exist in installation client and user client.
const getIntersectingRepos = (installationRepos, userRepos) => {
	const intersection: RepositoryNode[] = [];
	installationRepos.forEach((installationRepo) => {
		userRepos.forEach((userRepo) => {
			if (installationRepo.id === userRepo.id) {
				intersection.push(installationRepo);
			}
		});
	});
	return intersection;
};

const sortByScoreAndUpdatedAt = (a, b) => {
	if (a.score != b.score) {
		return a.score - b.score;
	}
	return new Date(b.updated_at).valueOf() - new Date(a.updated_at).valueOf();
};

const getOrgName = async (subscription: Subscription, jiraHost: string, logger: Logger) => {
	const metrics = { trigger: "github-repo-get" };
	const gitHubAppClient = await createAppClient(logger, jiraHost, subscription.gitHubAppId, metrics);
	const response = await gitHubAppClient.getInstallation(subscription.gitHubInstallationId);
	return response.data?.account?.login;
};
