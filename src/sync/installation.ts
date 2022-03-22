/* eslint-disable @typescript-eslint/no-explicit-any */
import SubscriptionClass, { Repositories, Repository, RepositoryData, SyncStatus } from "../models/subscription";
import { RepoSyncState, Subscription } from "../models";
import getJiraClient from "../jira/client";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit, { RateLimitingError as OldRateLimitingError } from "../config/enhance-octokit";
import statsd from "../config/statsd";
import getPullRequests from "./pull-request";
import getBranches from "./branches";
import { getCommits } from "./commits";
import { Application, GitHubAPI } from "probot";
import { metricSyncStatus, metricTaskStatus } from "../config/metric-names";
import { booleanFlag, BooleanFlags, isBlocked } from "../config/feature-flags";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout } from "./deduplicator";
import IORedis from "ioredis";
import getRedisInfo from "../config/redis-info";
import { GitHubAppClient } from "../github/client/github-app-client";
import { BackfillMessagePayload } from "../sqs/backfill";
import { Hub } from "@sentry/types/dist/hub";
import { sqsQueues } from "../sqs/queues";
import { getCloudInstallationId } from "../github/client/installation-id";
import { RateLimitingError } from "../github/client/github-client-errors";

const tasks: TaskProcessors = {
	pull: getPullRequests,
	branch: getBranches,
	commit: getCommits
};

interface TaskProcessors {
	[task: string]:
		(
			logger: LoggerWithTarget,
			github: GitHubAPI,
			newGithub: GitHubAppClient,
			jiraHost: string,
			repository: Repository,
			cursor?: string | number,
			perPage?: number
		) => Promise<{ edges: any[], jiraPayload: any }>;
}

type TaskType = "pull" | "commit" | "branch";

const taskTypes = Object.keys(tasks) as TaskType[];

export const sortedRepos = (repos: Repositories): [string, RepositoryData][] =>
	Object.entries(repos).sort(
		(a, b) =>
			new Date(b[1].repository?.updated_at || 0).getTime() -
			new Date(a[1].repository?.updated_at || 0).getTime()
	);

const getNextTask = async (subscription: SubscriptionClass): Promise<Task | undefined> => {
	const repos = await RepoSyncState.findAllFromSubscription(subscription, { order: [["repoUpdatedAt", "DESC"]] });
	const sorted: [string, RepositoryData][] = repos.map(repo => [repo.repoId.toString(), repo.toRepositoryData()]);

	for (const [repositoryId, repoData] of sorted) {
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

//Exported for testing
export const updateJobStatus = async (
	data: BackfillMessagePayload,
	edges: any[] | undefined,
	task: TaskType,
	repositoryId: string,
	logger: LoggerWithTarget,
	scheduleNextTask: (delay) => void
): Promise<void> => {
	const { installationId, jiraHost } = data;
	// Get a fresh subscription instance
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		logger.info("Organization has been deleted. Other active syncs will continue.");
		return;
	}

	const status = edges?.length ? "pending" : "complete";

	logger.info({ status }, "Updating job status");

	await subscription.updateRepoSyncStateItem(repositoryId, getStatusKey(task), status);

	if (edges?.length) {
		// there's more data to get
		await subscription.updateRepoSyncStateItem(repositoryId, getCursorKey(task), edges[edges.length - 1].cursor);

		scheduleNextTask(0);
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription))) {
		await subscription.update({ syncStatus: SyncStatus.COMPLETE });
		const endTime = Date.now();
		const startTime = data?.startTime || 0;
		const timeDiff = startTime ? endTime - Date.parse(startTime) : 0;
		if (startTime) {
			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricSyncStatus.fullSyncDuration, timeDiff);
		}

		logger.info({ startTime, endTime, timeDiff }, "Sync status is complete");
	} else {
		logger.info("Sync status is pending");
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
	if (err?.errors) {
		const retryableErrors = err?.errors?.find(
			(error) => "MAX_NODE_LIMIT_EXCEEDED" == error.type ||
				error.message?.startsWith("Something went wrong while executing your query")
		);

		return !!retryableErrors;
	} else {
		return false;
	}
};

// Checks if parsed error type is NOT_FOUND / status is 404 which come from 2 different sources
// - GraphqlError: https://github.com/octokit/graphql.js/tree/master#errors
// - RequestError: https://github.com/octokit/request.js/blob/5cef43ea4008728139686b6e542a62df28bb112a/src/fetch-wrapper.ts#L77
export const isNotFoundError = (
	err: any,
	logger: LoggerWithTarget
): boolean | undefined => {
	const isNotFoundErrorType =
		err?.errors && err.errors?.filter((error) => error.type === "NOT_FOUND");

	const isNotFoundError = isNotFoundErrorType?.length > 0 || err?.status === 404;

	isNotFoundError &&
	logger.info("Repository deleted after discovery, skipping initial sync");

	return isNotFoundError;
};

// TODO: type queues
async function doProcessInstallation(app, data: BackfillMessagePayload, sentry: Hub, installationId: number, jiraHost: string, logger: LoggerWithTarget, scheduleNextTask: (delayMs) => void): Promise<void> {
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

	const newGithub = new GitHubAppClient(getCloudInstallationId(installationId), logger);

	const github = await getEnhancedGitHub(app, installationId);
	const nextTask = await getNextTask(subscription);

	if (!nextTask) {
		await subscription.update({ syncStatus: "COMPLETE" });
		statsd.increment(metricSyncStatus.complete);
		logger.info("Sync complete");
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

	//TODO ARC-582 log task only if detailed logging enabled
	logger.info({ task: nextTask }, "Starting task");

	const processor = tasks[task];

	const execute = async () => {
		if (await booleanFlag(BooleanFlags.SIMPLER_PROCESSOR, true)) {

			// just try with one page size
			return await processor(logger, github, newGithub, jiraHost, repository, cursor, 20);

		} else {

			for (const perPage of [20, 10, 5, 1]) {
				// try for decreasing page sizes in case GitHub returns errors that should be retryable with smaller requests
				try {
					return await processor(logger, github, newGithub, jiraHost, repository, cursor, perPage);
				} catch (err) {
					logger.error({
						err,
						payload: data,
						github,
						repository,
						cursor,
						task
					}, `Error processing job with page size ${perPage}, retrying with next smallest page size`);
					if (!isRetryableWithSmallerRequest(err)) {
						// error is not retryable, re-throwing it
						throw err;
					}
					// error is retryable, retrying with next smaller page size
				}
			}
		}
		logger.error({ jiraHost, installationId, repositoryId, task }, "Error processing GraphQL query");
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
					sentry.setExtra(
						"Response body",
						err.response.data.errorMessages
					);
					sentry.setExtra("Jira payload", err.response.data.jiraPayload);
				}

				if (err.request) {
					sentry.setExtra("Request", {
						host: err.request.domain,
						path: err.request.path,
						method: err.request.method
					});
				}

				if (err.response) {
					sentry.setExtra("Response", {
						status: err.response.status,
						statusText: err.response.statusText,
						body: err.response.body
					});
				}

				throw err;
			}
		}

		await updateJobStatus(
			data,
			edges,
			task,
			repositoryId,
			logger,
			scheduleNextTask
		);

		statsd.increment(metricTaskStatus.complete, [`type: ${nextTask.task}`]);

	} catch (err) {
		await handleBackfillError(err, data, nextTask, subscription, logger, scheduleNextTask);
	}
}

/**
 * Handles an error and takes action based on the error type and parameters
 *
 * @param err The error
 * @param logger
 * @param scheduleNextTask Function which schedules next task with the specified delay
 * @param ignoreCurrentRepo Function which ignores currently processing repo and schedules the next task
 * @param failCurrentRepoAndContinue Function which sets the status of the current repo sync to "failed" and schedules the next task
 */
export const handleBackfillError = async (err,
	data: BackfillMessagePayload,
	nextTask: Task,
	subscription: SubscriptionClass,
	logger: LoggerWithTarget,
	scheduleNextTask: (delayMs: number) => void): Promise<void> => {

	const isRateLimitError = (err instanceof RateLimitingError || err instanceof OldRateLimitingError) || Number(err?.headers?.["x-ratelimit-remaining"]) == 0;

	if (isRateLimitError) {
		const rateLimit = (err instanceof RateLimitingError || err instanceof OldRateLimitingError) ? err.rateLimitReset : Number(err?.headers?.["x-ratelimit-reset"]);
		const delay = Math.max(rateLimit * 1000 - Date.now(), 0);

		if (delay) {
			// if not NaN or 0
			logger.info({ delay }, `Delaying job for ${delay}ms`);
			scheduleNextTask(delay);
		} else {
			//Retry immediately if rate limiting reset already
			logger.info("Rate limit was reset already. Scheduling next task");
			scheduleNextTask(0);
		}
		return;
	}

	if (String(err).includes("connect ETIMEDOUT")) {
		// There was a network connection issue.
		// Add the job back to the queue with a 5 second delay
		logger.warn("ETIMEDOUT error, retrying in 5 seconds");
		scheduleNextTask(5_000);
		return;
	}

	if (
		String(err.message).includes(
			"You have triggered an abuse detection mechanism"
		)
	) {
		// Too much server processing time, wait 60 seconds and try again
		logger.warn("Abuse detection triggered. Retrying in 60 seconds");
		scheduleNextTask(60_000);
		return;
	}

	// Continue sync when a 404/NOT_FOUND is returned
	if (isNotFoundError(err, logger)) {
		const edgesLeft = []; // No edges left to process since the repository doesn't exist
		await updateJobStatus(data, edgesLeft, nextTask.task, nextTask.repositoryId, logger, scheduleNextTask);
		return;
	}

	logger.error({ err }, "Task failed, continuing with next task");

	await markCurrentRepositoryAsFailedAndContinue(subscription, nextTask, scheduleNextTask);
};

export const markCurrentRepositoryAsFailedAndContinue = async (subscription: SubscriptionClass, nextTask: Task, scheduleNextTask: (delayMs: number) => void): Promise<void> => {
	// marking the current task as failed
	await subscription.updateRepoSyncStateItem(nextTask.repositoryId, getStatusKey(nextTask.task as TaskType), "failed");

	statsd.increment(metricTaskStatus.failed, [`type: ${nextTask.task}`]);

	// queueing the job again to pick up the next task
	scheduleNextTask(0);
};

// Export for unit testing. TODO: consider improving encapsulation by making this logic as part of Deduplicator, if needed
export async function maybeScheduleNextTask(
	jobData: BackfillMessagePayload,
	nextTaskDelaysMs: Array<number>,
	logger: LoggerWithTarget
) {
	if (nextTaskDelaysMs.length > 0) {
		nextTaskDelaysMs.sort().reverse();
		if (nextTaskDelaysMs.length > 1) {
			logger.warn("Multiple next jobs were scheduled, scheduling one with the highest priority");
		}
		const delayMs = nextTaskDelaysMs.shift()!;
		logger.info("Scheduling next job with a delay = " + delayMs);

		await sqsQueues.backfill.sendMessage(jobData, Math.ceil((delayMs || 0) / 1000), logger);
	}
}

const redis = new IORedis(getRedisInfo("installations-in-progress"));

const RETRY_DELAY_BASE_SEC = 60;
export const processInstallation =
	(app: Application) => {
		const inProgressStorage = new RedisInProgressStorageWithTimeout(redis);
		const deduplicator = new Deduplicator(
			inProgressStorage, 1_000
		);

		return async (data: BackfillMessagePayload, sentry: Hub, logger: LoggerWithTarget): Promise<void> => {
			const { installationId, jiraHost } = data;

			try {
				if (await isBlocked(installationId, logger)) {
					logger.warn("blocking installation job");
					return;
				}

				sentry.setUser({
					gitHubInstallationId: installationId,
					jiraHost
				});

				const nextTaskDelaysMs: Array<number> = [];

				const result = await deduplicator.executeWithDeduplication(
					"i-" + installationId + "-" + jiraHost,
					() => doProcessInstallation(app, data, sentry, installationId, jiraHost, logger, (delay: number) =>
						nextTaskDelaysMs.push(delay)
					));

				switch (result) {
					case DeduplicatorResult.E_OK:
						logger.info("Job was executed by deduplicator");
						maybeScheduleNextTask(data, nextTaskDelaysMs, logger);
						break;
					case DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER: {
						logger.warn("Possible duplicate job was detected, rescheduling");
						await sqsQueues.backfill.sendMessage(data, RETRY_DELAY_BASE_SEC, logger);
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
						await sqsQueues.backfill.sendMessage(data, RETRY_DELAY_BASE_SEC + RETRY_DELAY_BASE_SEC * Math.random(), logger);
						break;
					}
				}
			} catch (err) {
				logger.warn({ err }, "Process installation failed");
			}
		};
	};
