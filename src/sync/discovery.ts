import { Subscription } from "../models";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import { Repositories, SyncStatus } from "../models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { sqsQueues } from "../sqs/queues";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { Repository } from "@octokit/graphql-schema";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export const DISCOVERY_LOGGER_NAME = "sync.discovery";
const MAX_PAGE_SIZE_REPOSITORY = 100;

const getAllRepositories = async (github, hasNextPage: boolean, cursor?: string, repositories: Repository[] = []): Promise<Repository[]> => {
	if (!hasNextPage) {
		return repositories;
	}

	const result = await github.getRepositoriesPage(MAX_PAGE_SIZE_REPOSITORY, cursor);
	const edges = result?.viewer?.repositories?.edges || [];
	const nodes = edges.map(({ node: item }) => item);
	const repos = [...repositories, ...nodes];
	return getAllRepositories(github, result?.viewer?.repositories?.pageInfo?.hasNextPage, result?.viewer?.repositories?.pageInfo?.endCursor, repos);
}

// This is a temporary function to assit the feature flag USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY
// To tidy up, you can replace the call of this function with the true condition block
const getRepositories = async (app, installationId, jiraHost, logger) => {
	if (await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY, true, jiraHost)) {
		const github = new GitHubClient(getCloudInstallationId(installationId), logger);
		const repositories = await getAllRepositories(github, true);
		return repositories;
	}

	const github = await app.auth(installationId);
	enhanceOctokit(github);

	const repositories = await github.paginate(
		github.apps.listRepos.endpoint.merge({ per_page: 100 }),
		(res) => res.data.repositories
	);
	return repositories;
}

export const discovery = (app: Application) => async (job, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;

	const repositories = await getRepositories(app, installationId, jiraHost, logger);

	logger.info(
		{ job },
		`${repositories.length} Repositories found`
	);

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	if(!subscription) {
		logger.info({jiraHost, installationId}, "Subscription has been removed, ignoring job.");
		return;
	}

	if (repositories.length === 0) {
		await subscription.update({
			syncStatus: SyncStatus.COMPLETE
		});
		return;
	}

	// Store the repository object to prevent doing an additional query in each job
	// Also, with an object per repository we can calculate which repos are synched or not
	const repos: Repositories = repositories.reduce((obj, repo) => {
		obj[repo.id] = { repository: getRepositorySummary(repo) };
		return obj;
	}, {});

	await subscription.updateSyncState({
		numberOfSyncedRepos: 0,
		repos
	});

	await sqsQueues.backfill.sendMessage({installationId, jiraHost, startTime: startTime.toISOString()}, 0, logger);

};