import { Repositories, Repository, Subscription } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { GitHubAPI } from "probot";
import { TaskPayload } from "~/src/sync/installation";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { RepositoryNode } from "../github/client/github-queries";

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
const updateSyncState = async (subscription: Subscription, repositories: Repository[], totalNumberOfRepos?: number): Promise<void> => {
	await Promise.all([
		subscription.updateSyncState({
			repos: mapRepositories(repositories)
		}),
		totalNumberOfRepos && subscription.update({ totalNumberOfRepos })
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

	let totalCount: number;
	let nextCursor: string;
	let hasNextPage: boolean;
	let edges: RepositoryNode[];
	let repositories: Repository[];
	if (await booleanFlag(BooleanFlags.USE_REST_API_FOR_DISCOVERY, false, jiraHost)) {
		const page = Number(cursor);
		const response = await newGithub.getRepositoriesPageOld(page);
		hasNextPage = response.hasNextPage;
		totalCount = response.data.total_count;
		nextCursor = (page + 1).toString();
		repositories = response.data.repositories;
		edges = repositories?.map(repo => ({
			node: repo,
			cursor: nextCursor
		}));
	} else {
		const response = await newGithub.getRepositoriesPage(perPage, cursor as string);
		hasNextPage = response.viewer.repositories.pageInfo.hasNextPage;
		totalCount = response.viewer.repositories.totalCount;
		nextCursor = response.viewer.repositories.pageInfo.endCursor;
		// Attach the "cursor" (next page number) to each edge, because the function that uses this data
		// fetches the cursor from one of the edges instead of letting us return it explicitly.
		edges = response.viewer.repositories.edges.map((edge) => ({ ...edge, cursor: nextCursor }));
		repositories = edges.map(edge => edge?.node);
	}

	await updateSyncState(subscription, repositories, totalCount);
	logger.debug({ repositories }, `Added ${repositories.length} Repositories to state`);
	logger.info(`Added ${repositories.length} Repositories to state`);
	logger.debug(hasNextPage ? "Repository Discovery: Continuing" : "Repository Discovery: finished");

	return {
		edges,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};
