import { Subscription, Repositories, Repository } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { GitHubAPI } from "probot";
import { TaskPayload } from "~/src/sync/installation";
import { DiscoveryMessagePayload } from "~/src/sqs/discovery";
import { getCloudInstallationId } from "~/src/github/client/installation-id";
import { sqsQueues } from "~/src/sqs/queues";

/*
* Mapping the response data into a map by repo.id as required by subscription.updateSyncState.
*/
const mapRepositories = (repositories: Repository[]): Repositories => {
	return repositories.reduce((obj, repo) => {
		obj[repo.id] = { repository: repo };
		return obj;
	}, {});
};

/*
* Update the sync status of a batch of repos.
*/
const updateSyncState = async (subscription: Subscription, repositories: Repository[], totalNumberOfRepos: number): Promise<void> => {
	await Promise.all([
		subscription.updateSyncState({
			repos: mapRepositories(repositories)
		}),
		subscription.update({ totalNumberOfRepos })
	]);
};

export const getRepositoryTask = async (
	logger: LoggerWithTarget,
	_github: GitHubAPI,
	newGithub: GitHubInstallationClient,
	jiraHost: string,
	_repository: Repository,
	cursor?: string | number,
	perPage?: number
): Promise<TaskPayload> => {
	logger.debug("Repository Discovery: started");
	const installationId = newGithub.githubInstallationId.installationId;
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	if (!subscription) {
		logger.warn({ jiraHost, installationId }, "Subscription has been removed, ignoring repository task.");
		return { edges: [], jiraPayload: undefined };
	}

	const {
		viewer: {
			repositories: {
				totalCount,
				pageInfo: {
					endCursor: nextCursor,
					hasNextPage
				},
				edges
			}
		}
	} = await newGithub.getRepositoriesPage(perPage, cursor as string);

	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edgesWithCursor = edges.map((edge) => ({ ...edge, cursor: nextCursor }));
	const repositories = edges.map(edge => edge?.node);

	await updateSyncState(subscription, repositories, totalCount);
	logger.debug({ repositories }, `Added ${repositories.length} Repositories to state`);
	logger.info(`Added ${repositories.length} Repositories to state`);

	logger.debug(hasNextPage ? "Repository Discovery: Continuing" : "Repository Discovery: finished");

	return {
		edges: edgesWithCursor,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};

// TODO: remove everything after this line once new discovery backfill is deployed
export const discovery = async (data: DiscoveryMessagePayload, logger: LoggerWithTarget): Promise<void> => {
	const startTime = new Date().toISOString();
	const { jiraHost, installationId } = data;
	const github = new GitHubInstallationClient(getCloudInstallationId(installationId), logger);
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	if (!subscription) {
		logger.info({ jiraHost, installationId }, "Subscription has been removed, ignoring job.");
		return;
	}

	await syncRepositories(github, subscription, logger);
	await sqsQueues.backfill.sendMessage({ installationId, jiraHost, startTime }, 0, logger);
};

const syncRepositories = async (github: GitHubInstallationClient, subscription: Subscription, logger: LoggerWithTarget): Promise<void> => {
	let page = 1;
	let requestNextPage = true;
	await subscription.updateSyncState({ numberOfSyncedRepos: 0 });
	while (requestNextPage) {
		try {
			const { data, hasNextPage } = await github.getRepositoriesPageOld(page);
			requestNextPage = hasNextPage;
			await updateSyncState(subscription, data.repositories, data.total_count);
			logger.info(`${data.repositories.length} Repositories syncing`);
			page++;
		} catch (err) {
			requestNextPage = false;
			throw new Error(err);
		}
	}
};
