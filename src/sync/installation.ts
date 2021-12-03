/* eslint-disable @typescript-eslint/no-explicit-any */
import SubscriptionClass, {
	Repositories,
	Repository,
	RepositoryData,
	SyncStatus,
	TaskStatus
} from "../models/subscription";
import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import statsd from "../config/statsd";
import getPullRequests from "./pull-request";
import getBranches from "./branches";
import getCommits from "./commits";
import { Application, GitHubAPI } from "probot";
import { metricSyncStatus, metricTaskStatus } from "../config/metric-names";
import Queue from "bull";
import { booleanFlag, BooleanFlags, isBlocked } from "../config/feature-flags";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout } from "./deduplicator";
import Redis from "ioredis";
import getRedisInfo from "../config/redis-info";
import GitHubClient from "../github/client/github-client";
import {BackfillMessagePayload} from "../sqs/backfill";
import {Hub} from "@sentry/types/dist/hub";

export const INSTALLATION_LOGGER_NAME = "sync.installation";

const tasks: TaskProcessors = {
	pull: getPullRequests,
	branch: getBranches,
	commit: getCommits
};

interface TaskProcessors {
	[task: string]:
		(
			github: GitHubAPI,
			newGithub: GitHubClient,
			jiraHost: string,
			repository: Repository,
			cursor?: string | number,
			perPage?: number
		) => Promise<{ edges: any[], jiraPayload: any }>;
}

type TaskType = "pull" | "commit" | "branch";

const taskTypes = Object.keys(tasks) as TaskType[];

// TODO: why are we ignoring failed status as completed?
const taskStatusCompleted: TaskStatus[] = ["complete", "failed"]
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

	await subscription.updateNumberOfSyncedRepos(syncedRepos.length);
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
			cursor: cursor as any
		};
	}
	return undefined;
};

export interface Task {
	task: TaskType;
	repositoryId: string;
	repository: Repository;
	cursor?: string | number;
}

const upperFirst = (str: string) =>
	str.substring(0, 1).toUpperCase() + str.substring(1);
const getCursorKey = (type: TaskType) => `last${upperFirst(type)}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

const updateJobStatus = async (
	job: Queue.Job,
	edges: any[] | undefined,
	task: TaskType,
	repositoryId: string,
	logger: LoggerWithTarget,
	scheduleNextTask: (delay) => void
) => {
	const { installationId, jiraHost } = job.data;
	// Get a fresh subscription instance
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		// Include job and task in any micros env logs, exclude from local
		const loggerObj = process.env.MICROS_ENV ? { job, task } : {}
		logger.info(loggerObj, "Organization has been deleted. Other active syncs will continue.");
		return;
	}

	const status = edges?.length ? "pending" : "complete";

	logger.info({ job, task, status }, "Updating job status");

	await subscription.updateRepoSyncStateItem(repositoryId, getStatusKey(task), status);

	if (edges?.length) {
		// there's more data to get
		await subscription.updateRepoSyncStateItem(repositoryId, getCursorKey(task), edges[edges.length - 1].cursor);

		scheduleNextTask(0);
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription))) {
		await subscription.update({ syncStatus: SyncStatus.COMPLETE });
		const endTime = Date.now();
		const startTime = job.data?.startTime || 0;
		const timeDiff = endTime - Date.parse(startTime);
		if (startTime) {
			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricSyncStatus.fullSyncDuration, timeDiff);
		}

		logger.info({ job, task, startTime, endTime, timeDiff }, "Sync status is complete");
	} else {
		logger.info({ job, task }, "Sync status is pending");
		scheduleNextTask(0);
	}
};

const getEnhancedGitHub = async (app: Application, installationId) =>
	enhanceOctokit(await app.auth(installationId));

/**
 * Determines if an an error returned by the GitHub API means that we should retry it
 * with a smaller request (i.e. with fewer pages).
 * @param err the error thrown by Octokit.
 */
export const isRetryableWithSmallerRequest = (err): boolean => {
	if (err.errors) {

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
	nextTask: Task,
	logger: LoggerWithTarget
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

// TODO: type queues
async function doProcessInstallation(app, job, installationId: number, jiraHost: string, logger: LoggerWithTarget, scheduleNextTask: (delay) => void): Promise<void> {
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

	const newGithub = new GitHubClient(installationId, logger);

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

	const execute = async () => {
		if (await booleanFlag(BooleanFlags.SIMPLER_PROCESSOR, true)) {

			// just try with one page size
			return await processor(github, newGithub, jiraHost, repository, cursor, 20);

		} else {

			for (const perPage of [20, 10, 5, 1]) {
				// try for decreasing page sizes in case GitHub returns errors that should be retryable with smaller requests
				try {
					return await processor(github, newGithub, jiraHost, repository, cursor, perPage);
				} catch (err) {
					logger.error({
						err,
						job,
						github,
						repository,
						cursor,
						task
					}, `Error processing job with page size ${perPage}, retrying with next smallest page size`);
					if (isRetryableWithSmallerRequest(err)) {
						// error is retryable, retrying with next smaller page size
						continue;
					} else {
						// error is not retryable, re-throwing it
						throw err;
					}
				}
			}

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
			job,
			edges,
			task,
			repositoryId,
			logger,
			scheduleNextTask
		);

		statsd.increment(metricTaskStatus.complete, [`type: ${nextTask.task}`]);

	} catch (err) {
		const rateLimit = Number(err?.headers?.["x-ratelimit-reset"]);
		const delay = Math.max(Date.now() - rateLimit * 1000, 0);

		if (delay) {
			// if not NaN or 0
			logger.info({ delay, job, task: nextTask }, `Delaying job for ${delay}ms`);
			scheduleNextTask(delay);
			return;
		}

		if (String(err).includes("connect ETIMEDOUT")) {
			// There was a network connection issue.
			// Add the job back to the queue with a 5 second delay
			logger.warn({ job, task: nextTask }, "ETIMEDOUT error, retrying in 5 seconds");
			scheduleNextTask(5_000);
			return;
		}

		if (
			String(err.message).includes(
				"You have triggered an abuse detection mechanism"
			)
		) {
			// Too much server processing time, wait 60 seconds and try again
			logger.warn({ job, task: nextTask }, "Abuse detection triggered. Retrying in 60 seconds");
			scheduleNextTask(60_000)
			return;
		}

		// Continue sync when a 404/NOT_FOUND is returned
		if (isNotFoundError(err, job, nextTask, logger)) {
			const edgesLeft = []; // No edges left to process since the repository doesn't exist
			await updateJobStatus(job, edgesLeft, task, repositoryId, logger, scheduleNextTask);
			return;
		}


		// TODO: add the jiraHost to the logger with logger.child()
		const host = subscription.jiraHost || "none";
		logger.warn({ job, task: nextTask, err, jiraHost: host }, "Task failed, continuing with next task");

		// marking the current task as failed
		await subscription.updateRepoSyncStateItem(nextTask.repositoryId, getStatusKey(nextTask.task as TaskType), "failed");

		statsd.increment(metricTaskStatus.failed, [`type: ${nextTask.task}`]);

		// queueing the job again to pick up the next task
		scheduleNextTask(0);

	}
}

// Export for unit testing. TODO: consider improving encapsulation by making this logic as part of Deduplicator, if needed
export async function maybeScheduleNextTask(
	backfillQueue: BackfillQueue,
	jobData: BackfillMessagePayload,
	nextTaskDelays: Array<number>,
	logger: LoggerWithTarget
) {
	if (nextTaskDelays.length > 0) {
		nextTaskDelays.sort().reverse();
		if (nextTaskDelays.length > 1) {
			logger.warn("Multiple next jobs were scheduled, scheduling one with the highest priority");
		}
		const delay = nextTaskDelays.shift()!;
		logger.info("Scheduling next job with a delay = " + delay);
		await backfillQueue.schedule(jobData, delay, logger);
	}
}

export interface BackfillQueue {
	schedule: (message: BackfillMessagePayload, delayMsecs?: number, logger?: LoggerWithTarget) => Promise<void>;
}

export const processInstallation =
	(app: Application, backfillQueueSupplier: () => Promise<BackfillQueue>) => {
		const inProgressStorage = new RedisInProgressStorageWithTimeout(new Redis(getRedisInfo("installations-in-progress")));
		const deduplicator = new Deduplicator(
			inProgressStorage, 1_000
		);

		return async (job: {data: BackfillMessagePayload, sentry: Hub}, rootLogger: LoggerWithTarget): Promise<void> => {
			const { installationId, jiraHost } = job.data;

			const logger = rootLogger.child({ job });

			if (await isBlocked(installationId, logger)) {
				logger.warn({ job }, "blocking installation job");
				return;
			}

			job.sentry.setUser({
				gitHubInstallationId: installationId,
				jiraHost
			});

			const nextTaskDelays: Array<number> = [];

			const result = await deduplicator.executeWithDeduplication(
				"i-" + installationId + "-" + jiraHost,
				() => doProcessInstallation(app, job, installationId, jiraHost, logger, (delay: number) =>
					nextTaskDelays.push(delay)
				));

			switch (result) {
				case DeduplicatorResult.E_OK:
					logger.info("Job was executed by deduplicator");
					maybeScheduleNextTask(await backfillQueueSupplier(), job.data, nextTaskDelays, logger);
					break;
				case DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER: {
					logger.warn("Possible duplicate job was detected, rescheduling");
					const queue = await backfillQueueSupplier();
					await queue.schedule(job.data, 60_000, logger);
					break;
				}
				case DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB: {
					logger.warn("Duplicate job was detected, rescheduling");
					// There could be one case where we might be losing the message even if we are sure that another worker is doing the work:
					// Worker A - doing a long-running task
					// Redis/SQS - reports that the task execution takes too long and sends it to another worker
					// Worker B - checks the status of the task and sees that the Worker A is actually doing work, drops the message
					// Worker A dies (e.g. node is rotated).
					// In this situation we have a staled job since no message is on the queue an noone is doing the processing.
					//
					// Always rescheduling should be OK given that only one worker is working on the task right now: even if we
					// gather enough messages at the end of the queue, they all will be processed very quickly once the sync
					// is finished.
					const queue = await backfillQueueSupplier();
					await queue.schedule(job.data, Math.floor(60_000 + 60_000 * Math.random()), logger);
					break;
				}
			}
		}
	}
