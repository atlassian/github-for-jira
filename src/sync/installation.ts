/* eslint-disable @typescript-eslint/no-explicit-any */
import SubscriptionClass, { Repositories, Repository, RepositoryData, SyncStatus, TaskStatus } from "../models/subscription";
import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import statsd from "../config/statsd";
import getPullRequests from "./pull-request";
import getBranches from "./branches";
import getCommits from "./commits";
import { Application, GitHubAPI } from "probot";
import { metricHttpRequest, metricSyncStatus, metricTaskStatus } from "../config/metric-names";
import { getLogger } from "../config/logger";
import Queue from "bull";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "../config/feature-flags";
import { Queues } from "../worker/queues";

const logger = getLogger("sync.installation");

const tasks: TaskProcessors = {
	pull: getPullRequests,
	branch: getBranches,
	commit: getCommits
};

interface TaskProcessors {
	[task: string]:
		(
			github: GitHubAPI,
			repository: Repository,
			cursor?: string
		) => Promise<{ edges: { cursor: string }[], jiraPayload: any }>;
}

type TaskType = "pull" | "commit" | "branch";

const taskTypes = Object.keys(tasks) as TaskType[];

// TODO: why are we ignoring failed status as completed?
const taskStatusCompleted: TaskStatus[] = ["complete", "failed"];
const isAllTasksStatusesCompleted = (...statuses: (TaskStatus | undefined)[]): boolean =>
	statuses.every(status => !!status && taskStatusCompleted.includes(status));

const updateNumberOfReposSynced = async (
	repos: Repositories,
	subscription: SubscriptionClass
): Promise<void> => {
	const repoIds = Object.keys(repos || {});
	if (!repoIds.length) {
		return;
	}

	const syncedRepos = repoIds.filter((id: string) => {
		// all 3 statuses need to be complete for a repo to be fully synced
		const { pullStatus, branchStatus, commitStatus } = repos[id];
		return isAllTasksStatusesCompleted(pullStatus, branchStatus, commitStatus);
	});

	if (await booleanFlag(BooleanFlags.CUSTOM_QUERIES_FOR_REPO_SYNC_STATE, false)) {
		await subscription.updateNumberOfSyncedRepos(syncedRepos.length);
	} else {
		await subscription.update({
			repoSyncState: {
				...subscription.repoSyncState,
				numberOfSyncedRepos: syncedRepos.length
			}
		});
	}
};

export const sortedRepos = (repos: Repositories): [string, RepositoryData][] =>
	Object.entries(repos).sort(
		(a, b) =>
			new Date(b[1].repository?.updated_at || 0).getTime() -
			new Date(a[1].repository?.updated_at || 0).getTime()
	);

const getNextTask = async (subscription: SubscriptionClass): Promise<Task | undefined> => {
	const repos = subscription?.repoSyncState?.repos || {};
	await updateNumberOfReposSynced(repos, subscription);

	for (const [repositoryId, repoData] of sortedRepos(repos)) {
		const task = taskTypes.find(
			(taskType) => repoData[getStatusKey(taskType)] === undefined || repoData[getStatusKey(taskType)] === "pending"
		);
		if (!task) continue;
		const { repository, [getCursorKey(task)]: cursor } = repoData;
		return {
			task,
			repositoryId,
			repository: repository as Repository,
			cursor: cursor as string
		};
	}
	return undefined;
};

export interface Task {
	task: TaskType;
	repositoryId: string;
	repository: Repository;
	cursor?: string;
}

const upperFirst = (str: string) =>
	str.substring(0, 1).toUpperCase() + str.substring(1);
const getCursorKey = (type: TaskType) => `last${upperFirst(type)}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

const updateJobStatus = async (
	queues,
	job: Queue.Job,
	edges: any[] | undefined,
	task: TaskType,
	repositoryId: string
) => {
	const { installationId, jiraHost } = job.data;
	// Get a fresh subscription instance
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		logger.info({ job, task }, "Organization has been deleted. Other active syncs will continue.");
		return;
	}

	const status = edges?.length ? "pending" : "complete";
	logger.info({ job, task, status }, "Updating job status");

	if (await booleanFlag(BooleanFlags.CUSTOM_QUERIES_FOR_REPO_SYNC_STATE, false)) {
		await subscription.updateRepoSyncStateItem(repositoryId, getStatusKey(task), status);
	} else {
		await subscription.updateSyncState({
			repos: {
				[repositoryId]: {
					[getStatusKey(task)]: status
				}
			}
		});
	}

	if (edges?.length) {
		// there's more data to get
		if (await booleanFlag(BooleanFlags.CUSTOM_QUERIES_FOR_REPO_SYNC_STATE, false)) {
			await subscription.updateRepoSyncStateItem(repositoryId, getCursorKey(task), edges[edges.length - 1].cursor);
		} else {
			await subscription.updateSyncState({
				repos: {
					[repositoryId]: {
						[getCursorKey(task)]: edges[edges.length - 1].cursor
					}
				}
			});
		}

		queues.installation.add(job.data);
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription))) {
		await subscription.update({ syncStatus: SyncStatus.COMPLETE });
		const endTime = Date.now();
		const startTime = job.data?.startTime || 0;
		const timeDiff = endTime - Date.parse(startTime);
		if (startTime) {
			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricHttpRequest.fullSync, timeDiff);
		}

		logger.info({ job, task, startTime, endTime, timeDiff }, "Sync status is complete");
	} else {
		logger.info({ job, task }, "Sync status is pending");
		queues.installation.add(job.data);
	}
};

const getEnhancedGitHub = async (app: Application, installationId) =>
	enhanceOctokit(await app.auth(installationId));

const isBlocked = async (installationId: number): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]");
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString);
		return blockedInstallations.includes(installationId);
	} catch (e) {
		logger.error(e);
		return false;
	}
};

/**
 * Determines if an an error returned by the GitHub API means that we should retry it
 * with a smaller request (i.e. with fewer pages).
 * @param err the error thrown by Octokit.
 */
export const isRetryableWithSmallerRequest = (err): boolean => {
	if (err?.errors) {

		const retryableErrors = err.errors.filter(
			(error) => {
				return "MAX_NODE_LIMIT_EXCEEDED" == error.type
					|| error.message?.startsWith("Something went wrong while executing your query");
			}
		);

		return retryableErrors.length;
	} else {
		return false;
	}
};

// Checks if parsed error type is NOT_FOUND / status is 404 which come from 2 different sources
// - GraphqlError: https://github.com/octokit/graphql.js/tree/master#errors
// - RequestError: https://github.com/octokit/request.js/blob/5cef43ea4008728139686b6e542a62df28bb112a/src/fetch-wrapper.ts#L77
export const isNotFoundError = (
	err: any,
	job: any,
	nextTask: Task
): boolean | undefined => {
	const isNotFoundErrorType =
		err?.errors && err.errors?.filter((error) => error.type === "NOT_FOUND");

	const isNotFoundError = isNotFoundErrorType?.length > 0 || err?.status === 404;

	isNotFoundError &&
	logger.info(
		{ job, task: nextTask },
		"Repository deleted after discovery, skipping initial sync"
	);

	return isNotFoundError;
};

export const processInstallation = (app: Application, queues: Queues) =>
	async (job): Promise<void> => {
		const { installationId, jiraHost } = job.data;

		if (await isBlocked(installationId)) {
			logger.warn({ job }, "blocking installation job");
			return;
		}

		job.sentry.setUser({
			gitHubInstallationId: installationId,
			jiraHost
		});

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);
		// TODO: should this reject instead? it's just ignoring an error
		if (!subscription) return;

		const jiraClient = await getJiraClient(
			subscription.jiraHost,
			installationId,
			logger
		);
		const github = await getEnhancedGitHub(app, installationId);
		const nextTask = await getNextTask(subscription);

		if (!nextTask) {
			await subscription.update({ syncStatus: "COMPLETE" });
			statsd.increment(metricSyncStatus.complete);
			logger.info({ job, task: nextTask }, "Sync complete");
			return;
		}

		await subscription.update({ syncStatus: "ACTIVE" });

		const { task, repositoryId, cursor } = nextTask;
		let { repository } = nextTask;

		if (!repository) {
			// Old records don't have this info. New ones have it
			const { data: repo } = await github.request("GET /repositories/:id", {
				id: repositoryId
			});
			repository = getRepositorySummary(repo);
			await subscription.updateSyncState({
				repos: {
					[repository.id]: {
						repository
					}
				}
			});
		}

		logger.info({ job, task: nextTask }, "Starting task");

		const processor = tasks[task];

		const handleGitHubError = (err) => {
			if (err.errors) {
				const ignoredErrorTypes = ["MAX_NODE_LIMIT_EXCEEDED"];
				const notIgnoredError = err.errors.filter(
					(error) => !ignoredErrorTypes.includes(error.type)
				).length;

				if (notIgnoredError) {
					throw err;
				}
			} else {
				throw err;
			}
		};

		const execute = async () => {
			try {
				return await processor(github, repository, cursor);
			} catch (err) {
				logger.error({ err, job, github, repository, cursor, task }, "Error Executing Task");
				handleGitHubError(err);
			}

			throw new Error(`Error processing GraphQL query: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);
		};

		try {
			const { edges, jiraPayload } = await execute();

			if (jiraPayload) {
				try {
					await jiraClient.devinfo.repository.update(jiraPayload, {
						preventTransitions: true
					});
				} catch (err) {
					if (err?.response?.status === 400) {
						job.sentry.setExtra(
							"Response body",
							err.response.data.errorMessages
						);
						job.sentry.setExtra("Jira payload", err.response.data.jiraPayload);
					}

					if (err.request) {
						job.sentry.setExtra("Request", {
							host: err.request.domain,
							path: err.request.path,
							method: err.request.method
						});
					}

					if (err.response) {
						job.sentry.setExtra("Response", {
							status: err.response.status,
							statusText: err.response.statusText,
							body: err.response.body
						});
					}

					throw err;
				}
			}

			await updateJobStatus(
				queues,
				job,
				edges,
				task,
				repositoryId
			);

			statsd.increment(metricTaskStatus.complete, [`type: ${nextTask.task}`]);

		} catch (err) {
			const rateLimit = Number(err?.headers?.["x-ratelimit-reset"]);
			const delay = Math.max(Date.now() - rateLimit * 1000, 0);

			if (delay) {
				// if not NaN or 0
				logger.info({ delay, job, task: nextTask }, `Delaying job for ${delay}ms`);
				queues.installation.add(job.data, { delay });
				return;
			}

			if (String(err).includes("connect ETIMEDOUT")) {
				// There was a network connection issue.
				// Add the job back to the queue with a 5 second delay
				logger.warn({ job, task: nextTask }, "ETIMEDOUT error, retrying in 5 seconds");
				queues.installation.add(job.data, { delay: 5000 });
				return;
			}

			if (
				String(err.message).includes("You have triggered an abuse detection mechanism")
			) {
				// Too much server processing time, wait 60 seconds and try again
				logger.warn({ job, task: nextTask }, "Abuse detection triggered. Retrying in 60 seconds");
				queues.installation.add(job.data, { delay: 60000 });
				return;
			}

			// Continue sync when a 404/NOT_FOUND is returned
			if (isNotFoundError(err, job, nextTask)) {
				const edgesLeft = []; // No edges left to process since the repository doesn't exist
				await updateJobStatus(queues, job, edgesLeft, task, repositoryId);
				return;
			}

			if (await booleanFlag(BooleanFlags.CONTINUE_SYNC_ON_ERROR, false, jiraHost)) {

				// TODO: add the jiraHost to the logger with logger.child()
				const host = subscription.jiraHost || "none";
				logger.warn({ job, task: nextTask, err, jiraHost: host }, "Task failed, continuing with next task");

				// marking the current task as failed
				await subscription.updateRepoSyncStateItem(nextTask.repositoryId, getStatusKey(nextTask.task as TaskType), "failed");

				statsd.increment(metricTaskStatus.failed, [`type: ${nextTask.task}`]);

				// queueing the job again to pick up the next task
				queues.installation.add(job.data);
			} else {

				await subscription.update({ syncStatus: "FAILED" });

				// TODO: add the jiraHost to the logger with logger.child()
				const host = subscription.jiraHost || "none";
				logger.warn({ job, task: nextTask, err, jiraHost: host }, "Sync failed");

				job.sentry.setExtra("Installation FAILED", JSON.stringify(err, null, 2));
				job.sentry.captureException(err);

				statsd.increment(metricSyncStatus.failed);

				throw err;
			}
		}
	};
