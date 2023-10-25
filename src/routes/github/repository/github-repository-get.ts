import Logger from "bunyan";
import { Request, Response } from "express";
import { createAppClient, createInstallationClient } from "utils/get-github-client-config";
import { Subscription, Repository } from "~/src/models/subscription";
import { sendError } from "~/src/jira/util/jwt";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
const MAX_REPOS_RETURNED = 20;

export const GitHubRepositoryGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost: jiraHostLocals, gitHubAppConfig } = res.locals;
	const { jiraHost: jiraHostParam } = req.query;
	const repoName = req.query?.repoName as string;
	const jiraHost = jiraHostLocals || jiraHostParam;

	const log = req.log.child({ jiraHost, repoName });

	if (!jiraHost) {
		log.warn(Errors.MISSING_JIRA_HOST);
		sendError(res, 400, Errors.MISSING_JIRA_HOST);
		return;
	}

	if (!repoName) {
		log.error("No repoName found");
		res.send(400);
		return;
	}

	try {
		log.info("Start searching for repos");
		const repositories = await searchInstallationAndUserRepos(repoName, jiraHost, gitHubAppConfig.gitHubAppId || null, log);
		res.send({
			repositories
		});
	} catch (err: unknown) {
		log.error({ err }, "Error fetching repositories");
		res.status(200).send({
			repositories: []
		});
	}
};

const searchInstallationAndUserRepos = async (repoName: string, jiraHost: string, gitHubAppId: number | undefined, logger: Logger) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppId);
	const repos = await getReposBySubscriptions(repoName, subscriptions, jiraHost, logger);
	const ret = repos || [];
	logger.info({ reposLength: ret.length, subscriptionsLength: subscriptions.length }, ret.length === 0 ? "Couldn't find any match repos" : "Found match repos");
	return ret;
};

const getReposBySubscriptions = async (repoName: string, subscriptions: Subscription[], jiraHost: string, loggerParent: Logger): Promise<Repository[]> => {
	const repoTasks = subscriptions.map(async (subscription) => {
		const logger = loggerParent.child({ subscriptionId: subscription.id });
		try {
			const metrics = { trigger: "github-repo-get" };
			const [orgName, gitHubInstallationClient] = await Promise.all([
				getOrgName(subscription, jiraHost, logger).then(orgName => {
					logger.info({ orgName }, "Found orgName");
					return orgName;
				}),
				createInstallationClient(subscription.gitHubInstallationId, jiraHost, metrics, logger, subscription.gitHubAppId)
			]);

			const searchQueryInstallationString = `${repoName} org:${orgName} in:full_name fork:true`;

			const installationSearch = await gitHubInstallationClient.searchRepositories(searchQueryInstallationString, "updated")
				.then(responseInstallationSearch => {
					const userInstallationSearch = responseInstallationSearch.data?.items || [];
					logger.info(`Found ${userInstallationSearch.length} repos from installation search`);
					return userInstallationSearch;
				})
				// When there are not enough perms, the API might throw errors. We don't want that to stop the routine because there might
				// be other orgs connected where the customer has enough perms
				// https://docs.github.com/en/rest/search?apiVersion=2022-11-28#access-errors-or-missing-search-results
				.catch(err => {
					logger.warn({ err },"Cannot search for repos using installation client, falling back to empty array");
					return [];
				});

			// We don't want to return repos that are not in Database, otherwise we won't be able to fetch branches to branch from later
			// The app can be installed in a GitHub org but that org might not be connected to Jira, therefore we must filter them out, or
			// the next step (e.g. get repo branches to branch of) will fail
			const subscriptionOwners = await RepoSyncState.findAllRepoOwners(subscription);
			return installationSearch.filter(repo => subscriptionOwners.has(repo.owner.login));

		} catch (err: unknown) {
			logger.error({ err }, "Create branch - Failed to search repos for installation");
			return [];
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
	const metrics = { trigger: "github-repo-get" };
	const gitHubAppClient = await createAppClient(logger, jiraHost, subscription.gitHubAppId, metrics);
	const response = await gitHubAppClient.getInstallation(subscription.gitHubInstallationId);
	return response.data?.account?.login;
};
