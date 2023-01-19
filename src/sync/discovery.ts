import { Repository, Subscription } from "models/subscription";
import Logger from "bunyan";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { RepositoryNode } from "../github/client/github-queries";
import { RepoSyncState } from "models/reposyncstate";
import { TaskPayload } from "~/src/sync/sync.types";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { updateRepoConfigsFromGitHub } from "services/user-config-service";

export const getRepositoryTask = async (
	logger: Logger,
	newGithub: GitHubInstallationClient,
	jiraHost: string,
	_repository: Repository,
	cursor?: string | number,
	perPage?: number,
	messagePayload?: BackfillMessagePayload
): Promise<TaskPayload> => {

	logger.debug("Repository Discovery: started");
	const installationId = newGithub.githubInstallationId.installationId;
	const gitHubAppId = messagePayload?.gitHubAppConfig?.gitHubAppId;
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId,
		gitHubAppId
	);

	if (!subscription) {
		logger.warn({ jiraHost, installationId, gitHubAppId }, "Subscription has been removed, ignoring repository task.");
		return { edges: [], jiraPayload: undefined };
	}

	let totalCount: number;
	let nextCursor: string;
	let hasNextPage: boolean;
	let edges: RepositoryNode[];
	let repositories: Repository[];
	if (await booleanFlag(BooleanFlags.USE_REST_API_FOR_DISCOVERY, jiraHost)) {
		const page = Number(cursor) || 1;
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

	await subscription.update({ totalNumberOfRepos: totalCount });
	const createdRepoSyncStates = await RepoSyncState.bulkCreate(repositories.map(repo => ({
		subscriptionId: subscription.id,
		repoId: repo.id,
		repoName: repo.name,
		repoFullName: repo.full_name,
		repoOwner: repo.owner.login,
		repoUrl: repo.html_url,
		repoUpdatedAt: new Date(repo.updated_at)
	})), { updateOnDuplicate: ["subscriptionId", "repoId"] });

	logger.debug({
		repositories,
		repositoriesAdded: repositories.length,
		hasNextPage,
		totalCount,
		nextCursor
	}, `Repository Discovery Page Information`);
	logger.info(`Added ${repositories.length} Repositories to state`);
	logger.debug(hasNextPage ? "Repository Discovery: Continuing" : "Repository Discovery: finished");

	await updateRepoConfigsFromGitHub(createdRepoSyncStates, newGithub.githubInstallationId, jiraHost, gitHubAppId);

	return {
		edges,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};
