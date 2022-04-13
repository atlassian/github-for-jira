import { getRepositorySummary } from "./jobs";
import { Repositories, Repository, Subscription } from "models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { sqsQueues } from "../sqs/queues";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getCloudInstallationId } from "../github/client/installation-id";
import { DiscoveryMessagePayload } from "../sqs/discovery";

/*
* Mapping the response data into a map by repo.id as required by subscription.updateSyncState.
*/
const mapRepositories = (repositories: Repository[]): Repositories => {
	return repositories.reduce((obj, repo) => {
		obj[repo.id] = { repository: getRepositorySummary(repo) };
		return obj;
	}, {});
};

/*
* Reset the sync count to zero.
*/
const resetSyncedReposCount = async (subscription: Subscription): Promise<void> => {
	await subscription.updateSyncState({ numberOfSyncedRepos: 0 });
};

/*
* Update the sync status of a batch of repos.
*/
const updateSyncState = async (subscription: Subscription, repositories: Repository[]): Promise<void> => {
	const repos = mapRepositories(repositories);
	await subscription.updateSyncState({
		repos
	});
};

/*
* Continuosuly call the GitHub repo to fetch a page of repositories at a time and update there sync status until no more pages.
*/
const syncRepositories = async (github, subscription: Subscription, logger: LoggerWithTarget): Promise<void> => {
	let page = 1;
	let requestNextPage = true;
	await resetSyncedReposCount(subscription);
	while (requestNextPage) {
		try {
			const { data, hasNextPage } = await github.getRepositoriesPage(page);
			requestNextPage = hasNextPage;
			await updateSyncState(subscription, data.repositories);
			logger.debug({ page, hasNextPage }, `Adding ${data.repositories.length} repositories to be synced`);
			page++;
		} catch (err) {
			requestNextPage = false;
			throw new Error(err);
		}
	}
};

/*
* Use the github client to request all repositories and update the sync state per repo, send a bacnkfill queue message once complete.
*/
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
