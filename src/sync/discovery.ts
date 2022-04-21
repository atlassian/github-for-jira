import { Subscription, Repositories, Repository } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { GitHubAPI } from "probot";
import { TaskPayload } from "~/src/sync/installation";

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
const updateSyncState = async (subscription: Subscription, repositories: Repository[]): Promise<void> => {
	await subscription.updateSyncState({
		repos: mapRepositories(repositories)
	});
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
				pageInfo: {
					endCursor: nextCursor
				},
				edges
			}
		}
	} = await newGithub.getRepositoriesPage(perPage, cursor as string);

	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edgesWithCursor = edges.map((edge) => ({ ...edge, cursor: nextCursor }));
	const repositories = edges.map(edge => edge?.node);

	await updateSyncState(subscription, repositories);
	logger.info({repositories}, `Added ${repositories.length} Repositories to state`);

	logger.debug("Repository Discovery: finished");

	return {
		edges: edgesWithCursor,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};
