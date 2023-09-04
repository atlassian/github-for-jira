import { Repository, Subscription } from "models/subscription";
import Logger from "bunyan";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { RepoSyncState } from "models/reposyncstate";
import { TaskResultPayload } from "~/src/sync/sync.types";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { updateRepoConfigsFromGitHub } from "services/user-config-service";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const getRepositoryTask = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	_repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
): Promise<TaskResultPayload> => {

	const logger = parentLogger.child({ backfillTask: "Repository" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const installationId = gitHubInstallationClient.githubInstallationId.installationId;
	const gitHubAppId = messagePayload.gitHubAppConfig?.gitHubAppId;
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId,
		gitHubAppId
	);

	if (!subscription) {
		logger.warn({ jiraHost, installationId, gitHubAppId }, "Subscription has been removed, ignoring repository task.");
		logger.info({ processingTime: Date.now() - startTime, RepositoriesLength: 0 }, "Backfill task complete");
		return { edges: [], jiraPayload: undefined };
	}

	let hasNextPage: boolean;
	let totalCount: number;
	let nextCursor: string;
	let repositories: Repository[];
	if (await booleanFlag(BooleanFlags.USE_REST_API_FOR_DISCOVERY, jiraHost)) {
		const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);
		const response = await gitHubInstallationClient.getRepositoriesPageOld(smartCursor.perPage, smartCursor.pageNo);
		hasNextPage = response.hasNextPage;
		totalCount = response.data.total_count;
		nextCursor = smartCursor.copyWithPageNo(smartCursor.pageNo + 1).serialise();
		repositories = response.data.repositories;
	} else {
		const response = await gitHubInstallationClient.getRepositoriesPage(perPage, cursor);
		hasNextPage = response.viewer.repositories.pageInfo.hasNextPage;
		totalCount = response.viewer.repositories.totalCount;
		nextCursor = response.viewer.repositories.pageInfo.endCursor;
		// Attach the "cursor" (next page number) to each edge, because the function that uses this data
		// fetches the cursor from one of the edges instead of letting us return it explicitly.
		const edges = response.viewer.repositories.edges.map((edge) => ({ ...edge, cursor: nextCursor }));

		repositories = edges.map(edge => edge.node);
	}
	const edges = repositories.map(repo => ({
		node: repo,
		cursor: nextCursor
	}));

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
	logger.info({ processingTime: Date.now() - startTime, RepositoriesLength: repositories.length }, "Backfill task complete");
	logger.debug(hasNextPage ? "Repository Discovery: Continuing" : "Repository Discovery: finished");

	await updateRepoConfigsFromGitHub(createdRepoSyncStates, gitHubInstallationClient, logger);

	return {
		edges,
		jiraPayload: undefined // Nothing to save to jira just yet
	};
};
