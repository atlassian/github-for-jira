import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import Subscription, { Repositories, Repository, SyncStatus } from "../models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { sqsQueues } from "../sqs/queues";
import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";

export const DISCOVERY_LOGGER_NAME = "sync.discovery";

const mapRepositories = (repositories: Repository[]): Repositories => {
	return repositories.reduce((obj, repo) => {
		obj[repo.id] = { repository: getRepositorySummary(repo) };
		return obj;
	}, {});
};

const resetNumberOfSyncedRepos = async (subscription: Subscription) => {
	await subscription.updateSyncState({ numberOfSyncedRepos: 0 });
};

const updateSyncState = async (subscription: Subscription, repositories: Repository[]) => {
	const repos = mapRepositories(repositories);
	await subscription.updateSyncState({
		repos
	});
};

const checkHeaderForNextPage = (headers): boolean => {
	const links = headers?.link?.split(",");
	const regex = /(rel="next")/g;
	const hasNextPage = links?.find(elem => elem.match(regex));
	return hasNextPage;
};

const syncRepositories = async (github, subscription: Subscription, installationId: number, jiraHost: string, logger: LoggerWithTarget): Promise<void> => {
	let page = 0;
	let hasNextPage = true;
	await resetNumberOfSyncedRepos(subscription);
	while (hasNextPage) {
		try {
			const { data, headers } = await github.getRepositoriesPage(page);
			await updateSyncState(subscription, data.repositories);
			logger.info({ installationId, jiraHost }, `${data.repositories.length} Repositories syncing`);
			hasNextPage = checkHeaderForNextPage(headers);
			page++;
		} catch (err) {
			hasNextPage = false;
			throw new Error(err);
		}
	}
};

export const discovery = async (job, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;
	const github = new GitHubClient(getCloudInstallationId(installationId), logger);
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	if(!subscription) {
		logger.info({ jiraHost, installationId }, "Subscription has been removed, ignoring job.");
		return;
	}

	await syncRepositories(github, subscription, installationId, jiraHost, logger);
	await sqsQueues.backfill.sendMessage({ installationId, jiraHost, startTime: startTime.toISOString() }, 0, logger);
};

export const discoveryOctoKit = (app: Application) => async (job, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;
	const github = await app.auth(installationId);
	enhanceOctokit(github);

	try {
		const repositories = await github.paginate(
			github.apps.listRepos.endpoint.merge({ per_page: 100 }),
			(res) => res.data.repositories
		);
		logger.info(
			{ job },
			`${repositories.length} Repositories found`
		);

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);

		if(!subscription) {
			logger.info({ jiraHost, installationId }, "Subscription has been removed, ignoring job.");
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

		await sqsQueues.backfill.sendMessage({ installationId, jiraHost, startTime: startTime.toISOString() }, 0, logger);
	} catch (err) {
		logger.error({ job, err }, "Discovery error");
	}
};