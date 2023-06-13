import { Repository, Subscription } from "models/subscription";
import Logger from "bunyan";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { RepoSyncState } from "models/reposyncstate";
import { TaskResultPayload } from "~/src/sync/sync.types";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { updateRepoConfigsFromGitHub } from "services/user-config-service";

export const getRepositoryTask = async (
	logger: Logger,
	githubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	_repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
): Promise<TaskResultPayload> => {

	logger.debug("Repository Discovery: started");
	const installationId = githubInstallationClient.githubInstallationId.installationId;
	const gitHubAppId = messagePayload.gitHubAppConfig?.gitHubAppId;
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId,
		gitHubAppId
	);

	if (!subscription) {
		logger.warn({ jiraHost, installationId, gitHubAppId }, "Subscription has been removed, ignoring repository task.");
		return { edges: [], jiraPayload: undefined };
	}

	const response = await githubInstallationClient.getRepositoriesPage(perPage, cursor as string);
	const hasNextPage = response.viewer.repositories.pageInfo.hasNextPage;
	const totalCount = response.viewer.repositories.totalCount;
	const nextCursor = response.viewer.repositories.pageInfo.endCursor;
	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edges = response.viewer.repositories.edges.map((edge) => ({ ...edge, cursor: nextCursor }));
	const repositories = edges.map(edge => edge?.node);

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
		repositoriesAdded: repositories.length,
		hasNextPage,
		totalCount,
		nextCursor
	}, `Repository Discovery Page Information`);
	logger.info(`Added ${repositories.length} Repositories to state`);
	logger.debug(hasNextPage ? "Repository Discovery: Continuing" : "Repository Discovery: finished");

	await updateRepoConfigsFromGitHub(createdRepoSyncStates, githubInstallationClient);

	return {
		edges,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};
