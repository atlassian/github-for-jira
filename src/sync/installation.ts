/* eslint-disable @typescript-eslint/no-explicit-any */
import { intersection, omit, pick } from "lodash";
import IORedis from "ioredis";
import Logger from "bunyan";
import { Repository, Subscription, SyncStatus } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { getJiraClient } from "../jira/client/jira-client";
import { statsd } from "config/statsd";
import { getPullRequestTask } from "./pull-request";
import { getBranchTask } from "./branches";
import { getCommitTask } from "./commits";
import { getBuildTask } from "./build";
import { getDeploymentTask } from "./deployment";
import { metricSyncStatus, metricTaskStatus } from "config/metric-names";
import { isBlocked } from "config/feature-flags";
import { Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout } from "./deduplicator";
import { getRedisInfo } from "config/redis-info";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { Hub } from "@sentry/types/dist/hub";
import { sqsQueues } from "../sqs/queues";
import { RateLimitingError } from "../github/client/github-client-errors";
import { getRepositoryTask } from "~/src/sync/discovery";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { Task, TaskPayload, TaskProcessors, TaskType } from "./sync.types";
import { ConnectionTimedOutError } from "sequelize";

const tasks: TaskProcessors = {
	repository: getRepositoryTask,
	pull: getPullRequestTask,
	branch: getBranchTask,
	commit: getCommitTask,
	build: getBuildTask,
	deployment: getDeploymentTask
};

const allTaskTypes: TaskType[] = ["pull", "branch", "commit", "build", "deployment"];

export const getTargetTasks = (targetTasks?: TaskType[]): TaskType[] => {
	if (targetTasks?.length) {
		return intersection(allTaskTypes, targetTasks);
	}

	return allTaskTypes;
};
const getNextTask = async (subscription: Subscription, targetTasks?: TaskType[]): Promise<Task | undefined> => {
	if (subscription.repositoryStatus !== "complete") {
		return {
			task: "repository",
			repositoryId: 0,
			repository: {} as Repository,
			cursor: subscription.repositoryCursor || undefined
		};
	}

	const tasks = getTargetTasks(targetTasks);

	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, { order: [["repoUpdatedAt", "DESC"]] });

	for (const syncState of repoSyncStates) {
		const task = tasks.find(
			(taskType) => !syncState[getStatusKey(taskType)] || syncState[getStatusKey(taskType)] === "pending"
		);
		if (!task) continue;
		return {
			task,
			repositoryId: syncState.repoId,
			repository: {
				id: syncState.repoId,
				name: syncState.repoName,
				full_name: syncState.repoFullName,
				owner: { login: syncState.repoOwner },
				html_url: syncState.repoUrl,
				updated_at: syncState.repoUpdatedAt?.toISOString()
			},
			cursor: syncState[getCursorKey(task)] || undefined
		};
	}
	return undefined;
};

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

// Exported for testing
export const updateJobStatus = async (
	data: BackfillMessagePayload,
	taskPayload: TaskPayload,
	task: TaskType,
	repositoryId: number,
	logger: Logger,
	scheduleNextTask: (delay) => void
): Promise<void> => {
	const { installationId, jiraHost, targetTasks } = data;
	// Get a fresh subscription instance
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId,
		data.gitHubAppConfig?.gitHubAppId
	);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		logger.info("Organization has been deleted. Other active syncs will continue.");
		return;
	}
	const { edges } = taskPayload;
	const isComplete = !edges?.length;

	const status = isComplete ? "complete" : "pending";

	logger.info({ status }, "Updating job status");
	await updateRepo(subscription, repositoryId, { [getStatusKey(task)]: status });

	if (!isComplete) {
		// there's more data to get
		await updateRepo(subscription, repositoryId, { [getCursorKey(task)]: edges[edges.length - 1].cursor });
		scheduleNextTask(0);
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription, targetTasks))) {
		await subscription.update({ syncStatus: SyncStatus.COMPLETE });
		const endTime = Date.now();
		const startTime = data?.startTime || 0;
		const timeDiff = startTime ? endTime - Date.parse(startTime) : 0;
		const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);

		if (startTime) {
			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricSyncStatus.fullSyncDuration, timeDiff, { gitHubProduct });
		}

		logger.info({ startTime, endTime, timeDiff, gitHubProduct }, "Sync status is complete");
	} else {
		logger.info("Sync status is pending");
		scheduleNextTask(0);
	}
};

/**
 * Determines if an an error returned by the GitHub API means that we should retry it
 * with a smaller request (i.e. with fewer pages).
 * @param err the error thrown by Octokit.
 */
export const isRetryableWithSmallerRequest = (err) =>
	err?.isRetryable || false;

// Checks if parsed error type is NOT_FOUND / status is 404 which come from 2 different sources
// - GraphqlError: https://github.com/octokit/graphql.js/tree/master#errors
// - RequestError: https://github.com/octokit/request.js/blob/5cef43ea4008728139686b6e542a62df28bb112a/src/fetch-wrapper.ts#L77
export const isNotFoundError = (
	err: any,
	logger: Logger
): boolean | undefined => {
	const isNotFoundErrorType =
		err?.errors && err.errors?.filter((error) => error.type === "NOT_FOUND");

	const isNotFoundError = isNotFoundErrorType?.length > 0 || err?.status === 404;

	isNotFoundError &&
	logger.info("Repository deleted after discovery, skipping initial sync");

	return isNotFoundError;
};

const sendJiraFailureToSentry = (err, sentry: Hub) => {
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
};

// TODO: type queues
const doProcessInstallation = async (data: BackfillMessagePayload, sentry: Hub, gitHubInstallationId: number, jiraHost: string, rootLogger: Logger, scheduleNextTask: (delayMs) => void): Promise<void> => {
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		gitHubInstallationId,
		data.gitHubAppConfig?.gitHubAppId
	);

	// TODO: should this reject instead? it's just ignoring an error
	if (!subscription) {
		rootLogger.warn("No subscription found. Exiting backfill");
		return;
	}

	const nextTask = await getNextTask(subscription, data.targetTasks);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);

	if (!nextTask) {
		await subscription.update({ syncStatus: "COMPLETE" });
		statsd.increment(metricSyncStatus.complete, { gitHubProduct });
		rootLogger.info({ gitHubProduct }, "Sync complete");

		return;
	}

	await subscription.update({ syncStatus: "ACTIVE" });

	const { task, cursor, repository } = nextTask;

	const logger = rootLogger.child({
		task: nextTask,
		gitHubProduct,
		startTime: data.startTime,
		commitsFromDate: data.commitsFromDate
	});

	logger.info("Starting task");

	const processor = tasks[task];

	const execute = async (): Promise<TaskPayload> => {
		const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraHost, logger, data.gitHubAppConfig?.gitHubAppId);
		for (const perPage of [20, 10, 5, 1]) {
			// try for decreasing page sizes in case GitHub returns errors that should be retryable with smaller requests
			try {
				return await processor(logger, gitHubInstallationClient, jiraHost, repository, cursor, perPage, data);
			} catch (err) {
				const errorLog = logger.child({ err });
				// TODO - need a better way to manage GitHub errors globally
				// In the event that the customer has not accepted the required permissions.
				// We will continue to process the data per usual while omitting the tasks the app does not have access too.
				// The GraphQL errors do not return a status so we check 403 or undefined
				if ((err.status === 403 || err.status === undefined) && err.message?.includes("Resource not accessible by integration")) {
					await subscription?.update({ syncWarning: `Invalid permissions for ${task} task` });
					errorLog.error(`Invalid permissions for ${task} task`);
					// Return undefined objects so the sync can complete while skipping this task
					return { edges: undefined, jiraPayload: undefined };
				}

				errorLog.warn(`Error processing job with page size ${perPage}, retrying with next smallest page size`);
				if (!isRetryableWithSmallerRequest(err)) {
					// error is not retryable, re-throwing it
					errorLog.warn(`Not retryable error, rethrowing`);
					throw err;
				}
				// error is retryable, retrying with next smaller page size
				errorLog.info(`Retryable error, try again with a smaller page size`);
			}
		}
		logger.error("Error processing task after trying all page sizes");
		throw new Error(`Error processing task after trying all page sizes: installationId=${gitHubInstallationId}, repositoryId=${nextTask.repositoryId}, task=${task}`);
	};

	try {
		const taskPayload = await execute();
		if (taskPayload.jiraPayload) {
			try {
				// In "try" because it could fail if cryptor throws a error, and we don't want to kill the whole backfilling in this case
				const jiraClient = await getJiraClient(
					subscription.jiraHost,
					gitHubInstallationId,
					data.gitHubAppConfig?.gitHubAppId,
					logger
				);
				switch (task) {
					case "build":
						await jiraClient.workflow.submit(taskPayload.jiraPayload, {
							preventTransitions: true,
							operationType: "BACKFILL"
						});
						break;
					case "deployment":
						await jiraClient.deployment.submit(taskPayload.jiraPayload, {
							preventTransitions: true,
							operationType: "BACKFILL"
						});
						break;
					default:
						await jiraClient.devinfo.repository.update(taskPayload.jiraPayload, {
							preventTransitions: true,
							operationType: "BACKFILL"
						});
				}
			} catch (err) {
				logger.warn({ err }, "Failed to send data to Jira");
				sendJiraFailureToSentry(err, sentry);

				// TODO: this won't reach SQS handler but will be stuck in handleBackfillError and will mark the task as failed.
				//       Something we should fix sooner rather than later...
				throw err;
			}
		}

		await updateJobStatus(
			data,
			taskPayload,
			task,
			nextTask.repositoryId,
			logger,
			scheduleNextTask
		);

		statsd.increment(metricTaskStatus.complete, [`type:${nextTask.task}`, `gitHubProduct:${gitHubProduct}`]);

	} catch (err) {
		await handleBackfillError(err, data, nextTask, subscription, logger, scheduleNextTask);
	}
};

/**
 * Handles an error and takes action based on the error type and parameters
 */
export const handleBackfillError = async (
	err,
	data: BackfillMessagePayload,
	nextTask: Task,
	subscription: Subscription,
	rootLogger: Logger,
	scheduleNextTask: (delayMs: number) => void): Promise<void> => {

	const logger = rootLogger.child({ err });

	const isRateLimitError = err instanceof RateLimitingError || Number(err?.headers?.["x-ratelimit-remaining"]) == 0;

	if (isRateLimitError) {
		const rateLimit = err instanceof RateLimitingError ? err.rateLimitReset : Number(err?.headers?.["x-ratelimit-reset"]);
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
		logger.warn("ETIMEDOUT error, retrying in 5 seconds");
		scheduleNextTask(5_000);
		return;
	}

	if (String(err).includes("connect ECONNREFUSED")) {
		logger.warn("ECONNREFUSED error, retrying in 30 seconds");
		scheduleNextTask(30_000);
		return;
	}

	if (err instanceof ConnectionTimedOutError) {
		logger.warn("ConnectionTimedOutError error, retrying in 30 seconds");
		scheduleNextTask(30_000);
		return;
	}

	// TODO: replace with "instanceof" when sequelize version is upgraded to some modern one
	// Capturing errors like SequelizeConnectionError, SequelizeConnectionAcquireTimeoutError etc
	// that are not exported from sequelize
	if (String(err.name).toLowerCase().includes("sequelize")) {
		logger.warn("sequelize error, retrying in 30 seconds");
		scheduleNextTask(30_000);
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
		// No edges left to process since the repository doesn't exist
		await updateJobStatus(data, { edges: [] }, nextTask.task, nextTask.repositoryId, logger, scheduleNextTask);
		return;
	}

	logger.warn({ err, nextTask }, "Task failed, continuing with next task");
	await markCurrentRepositoryAsFailedAndContinue(subscription, nextTask, scheduleNextTask);
};

export const markCurrentRepositoryAsFailedAndContinue = async (subscription: Subscription, nextTask: Task, scheduleNextTask: (delayMs: number) => void): Promise<void> => {
	// marking the current task as failed
	await updateRepo(subscription, nextTask.repositoryId, { [getStatusKey(nextTask.task)]: "failed" });
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);
	statsd.increment(metricTaskStatus.failed, [`type:${nextTask.task}`, `gitHubProduct:${gitHubProduct}`]);

	if (nextTask.task === "repository") {
		await subscription.update({ syncStatus: SyncStatus.FAILED });
		return;
	}
	// queueing the job again to pick up the next task
	scheduleNextTask(0);
};

// Export for unit testing. TODO: consider improving encapsulation by making this logic as part of Deduplicator, if needed
export const maybeScheduleNextTask = async (
	jobData: BackfillMessagePayload,
	nextTaskDelaysMs: Array<number>,
	logger: Logger
) => {
	if (nextTaskDelaysMs.length) {
		nextTaskDelaysMs.sort().reverse();
		if (nextTaskDelaysMs.length > 1) {
			logger.warn("Multiple next jobs were scheduled, scheduling one with the highest priority");
		}
		const delayMs = nextTaskDelaysMs.shift();
		logger.info("Scheduling next job with a delay = " + delayMs);
		await sqsQueues.backfill.sendMessage(jobData, Math.ceil((delayMs || 0) / 1000), logger);
	}
};

const redis = new IORedis(getRedisInfo("installations-in-progress"));

const RETRY_DELAY_BASE_SEC = 60;

export const processInstallation = () => {
	const inProgressStorage = new RedisInProgressStorageWithTimeout(redis);
	const deduplicator = new Deduplicator(
		inProgressStorage, 1_000
	);

	return async (data: BackfillMessagePayload, sentry: Hub, logger: Logger): Promise<void> => {
		const { installationId, jiraHost } = data;
		const gitHubAppId: number | undefined = data.gitHubAppConfig?.gitHubAppId;

		logger.child({ gitHubInstallationId: installationId, jiraHost });

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
				`i-${installationId}-${jiraHost}-ghaid-${gitHubAppId || "cloud"}`,
				() => doProcessInstallation(data, sentry, installationId, jiraHost, logger, (delay: number) =>
					nextTaskDelaysMs.push(delay)
				));

			switch (result) {
				case DeduplicatorResult.E_OK:
					logger.info("Job was executed by deduplicator");
					await maybeScheduleNextTask(data, nextTaskDelaysMs, logger);
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
			// Error because looks like the installation sync has been stuck for the poor customer with
			// some error we were not anticipated and shouldn't have occurred in the first place
			logger.error({ err }, "Process installation failed");
		}
	};
};

const updateRepo = async (subscription: Subscription, repoId: number, values: Record<string, unknown>) => {
	const repoStates = pick(values, ["repositoryStatus", "repositoryCursor"]);
	const rest = omit(values, ["repositoryStatus", "repositoryCursor"]);
	await Promise.all([
		Object.keys(repoStates).length && subscription.update(repoStates),
		Object.keys(rest).length && RepoSyncState.updateRepoFromSubscription(subscription, repoId, rest)
	]);
};
