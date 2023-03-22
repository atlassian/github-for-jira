/* eslint-disable @typescript-eslint/no-explicit-any */
import { intersection, omit, pick, without } from "lodash";
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
import { repoCountToBucket } from "config/metric-helpers";
import { isBlocked } from "config/feature-flags";
import { Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout } from "./deduplicator";
import { getRedisInfo } from "config/redis-info";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { Hub } from "@sentry/types/dist/hub";
import { GithubClientError, GithubClientGraphQLError, RateLimitingError } from "../github/client/github-client-errors";
import { getRepositoryTask } from "~/src/sync/discovery";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { Task, TaskPayload, TaskProcessors, TaskType } from "./sync.types";
import { SQS } from "aws-sdk";
import _ from "lodash";

const tasks: TaskProcessors = {
	repository: getRepositoryTask,
	pull: getPullRequestTask,
	branch: getBranchTask,
	commit: getCommitTask,
	build: getBuildTask,
	deployment: getDeploymentTask
};

const allTaskTypes: TaskType[] = ["pull", "branch", "commit", "build", "deployment"];
const allTasksExceptBranch = without(allTaskTypes, "branch");

export const getTargetTasks = (targetTasks?: TaskType[]): TaskType[] => {
	if (targetTasks?.length) {
		return intersection(allTaskTypes, targetTasks);
	}

	return allTaskTypes;
};

export class TaskError extends Error {
	task: Task;
	cause: Error;
	constructor(task: Task, cause: Error) {
		super(cause.message);
		this.task = _.cloneDeep(task);
		this.cause = cause;
	}
}

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
	// Order on "id" is to have deterministic behaviour when there are records without "repoUpdatedAt"
	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, { order: [["repoUpdatedAt", "DESC"], ["id", "DESC"]] });

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
const getFromDateKey = (type: TaskType) => `${type}From`;

// Exported for testing
export const updateJobStatus = async (
	data: BackfillMessagePayload,
	taskPayload: TaskPayload,
	task: TaskType,
	repositoryId: number,
	logger: Logger,
	scheduleNextTask: (delay) => void
): Promise<void> => {
	const { targetTasks } = data;
	// Get a fresh subscription instance
	const subscription = await findSubscriptionForMessage(data);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		logger.info("Organization has been deleted. Other active syncs will continue.");
		return;
	}
	const { edges } = taskPayload;
	const isComplete = !edges?.length;

	const status = isComplete ? "complete" : "pending";

	logger.info({ status }, "Updating job status");

	const updateRepoSyncFields: { [x: string]: string | Date} = { [getStatusKey(task)]: status };

	//Set the complete date on success for tasks.
	//Skip branches as it sync all history
	if (isComplete && allTasksExceptBranch.includes(task) && data.commitsFromDate) {
		const repoSync = await RepoSyncState.findByRepoId(subscription, repositoryId);
		if (repoSync) {
			const newFromDate =  new Date(data.commitsFromDate);
			const existingFromDate = repoSync[getFromDateKey(task)];
			if (!existingFromDate || newFromDate.getTime() < existingFromDate.getTime()) {
				updateRepoSyncFields[getFromDateKey(task)] = newFromDate;
			}
		}
	}

	await updateRepo(subscription, repositoryId, updateRepoSyncFields);

	if (!isComplete) {
		// there's more data to get
		await updateRepo(subscription, repositoryId, { [getCursorKey(task)]: edges[edges.length - 1].cursor });
		scheduleNextTask(0);
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription, targetTasks))) {
		await subscription.update({
			syncStatus: SyncStatus.COMPLETE,
			backfillSince: await getBackfillSince(data, logger)
		});
		const endTime = Date.now();
		const startTime = data?.startTime || 0;
		const timeDiff = startTime ? endTime - Date.parse(startTime) : 0;
		const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);

		if (startTime) {
			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricSyncStatus.fullSyncDuration, timeDiff, {
				...data.metricTags,
				gitHubProduct,
				repos: repoCountToBucket(subscription.totalNumberOfRepos)
			});
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

const isNotFoundGithubError = (err: GithubClientError) => () =>
	(err.status === 404) ||
	(err instanceof GithubClientGraphQLError && err.isNotFound());

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
const doProcessInstallation = async (data: BackfillMessagePayload, sentry: Hub, rootLogger: Logger, scheduleNextTask: (delayMs) => void): Promise<void> => {
	const { installationId: gitHubInstallationId, jiraHost } = data;
	const subscription = await findSubscriptionForMessage(data);

	// TODO: should this reject instead? it's just ignoring an error
	if (!subscription) {
		rootLogger.warn("No subscription found. Exiting backfill");
		return;
	}

	const nextTask = await getNextTask(subscription, data.targetTasks);
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);

	if (!nextTask) {
		await subscription.update({
			syncStatus: "COMPLETE",
			backfillSince: await getBackfillSince(data, rootLogger)
		});
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
		//
		// We are not using "big" numbers here (e.g. 100) to speed up the process; API returns smaller pages faster and
		// they will more likely not to break.
		//
		// Also this logic is broken for any rest queries (where cursor is the page number), because when the page size
		// changes the cursor is broken (as it is just an interger specifically for the original page size).
		//
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
					await updateRepo(subscription, nextTask.repositoryId, { failedCode: "PERMISSIONS_ERROR" });
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
		await handleBackfillError(err, data, nextTask, logger, scheduleNextTask);
	}
};

/**
 * Handles an error and takes action based on the error type and parameters
 */
export const handleBackfillError = async (
	err: Error,
	data: BackfillMessagePayload,
	nextTask: Task,
	rootLogger: Logger,
	scheduleNextTask: (delayMs: number) => void): Promise<void> => {

	const logger = rootLogger.child({ err });

	// TODO: rethrow as TaskError and handle in SQS error handler
	if (err instanceof RateLimitingError) {
		const delayMs = Math.max(err.rateLimitReset * 1000 - Date.now(), 0);

		if (delayMs) {
			// if not NaN or 0
			logger.info({ delay: delayMs }, `Delaying job for ${delayMs}ms`);
			scheduleNextTask(delayMs);
		} else {
			//Retry immediately if rate limiting reset already
			logger.info("Rate limit was reset already. Scheduling next task");
			scheduleNextTask(0);
		}
		return;
	}

	// TODO: throw TaskError and handle in SQS error handler
	// Continue sync when a 404/NOT_FOUND is returned from GitHub
	if (err instanceof GithubClientError && isNotFoundGithubError(err)) {
		// No edges left to process since the repository doesn't exist
		logger.info("Repo was deleted, marking the task as completed");
		await updateJobStatus(data, { edges: [] }, nextTask.task, nextTask.repositoryId, logger, scheduleNextTask);
		return;
	}

	logger.info("Rethrow unknown error to retry in SQS error handler");
	throw new TaskError(nextTask, err);
};

const findSubscriptionForMessage = (data: BackfillMessagePayload) =>
	Subscription.getSingleInstallation(
		data.jiraHost,
		data.installationId,
		data.gitHubAppConfig?.gitHubAppId
	);

export const markCurrentTaskAsFailedAndContinue = async (data: BackfillMessagePayload, nextTask: Task, scheduleNextTask: (delayMs: number) => void, log: Logger, err: Error): Promise<void> => {
	const subscription = await findSubscriptionForMessage(data);
	if (!subscription) {
		log.warn("No subscription found, nothing to do");
		return;
	}

	// marking the current task as failed, this value will override any preexisting failedCodes and only keep the last known failed issue.
	const failedCode = getFailedCode(err);

	// marking the current task as failed
	await updateRepo(subscription, nextTask.repositoryId, { [getStatusKey(nextTask.task)]: "failed", failedCode });
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);
	statsd.increment(metricTaskStatus.failed, [`type:${nextTask.task}`, `gitHubProduct:${gitHubProduct}`]);

	if (nextTask.task === "repository") {
		await subscription.update({ syncStatus: SyncStatus.FAILED });
		return;
	}
	// queueing the job again to pick up the next task
	scheduleNextTask(0);
};

const getFailedCode = (err): string => {
	const { status, message, code } = err;

	// Socket is closed or Client network socket disconnected before secure TLS connection was established
	if (code === "ERR_SOCKET_CLOSED" || code === "ECONNRESET") {
		return "CONNECTION_ERROR";
	}
	if (status === 401) {
		return "AUTHENTICATION_ERROR";
	}
	// A generic catch for authorization issues, invalid permissions on the JWT
	if (status === 403) {
		return "AUTHORIZATION_ERROR";
	}
	// If the user hasn't accepted updated permissions for the app.
	if (status === 200 && message === "Resource not accessible by integration") {
		return "PERMISSIONS_ERROR";
	}
	// Server error, Could be GitHub or Jira
	if (status === 500 || status === 502 || status === 503) {
		return "SERVER_ERROR";
	}
	// After we have tried all variations of pages sizes down to 1
	if (message?.includes("Error processing task after trying all page sizes")) {
		return "CURSOR_ERROR";
	}
	return "UNKNOWN_ERROR";
};

// Export for unit testing. TODO: consider improving encapsulation by making this logic as part of Deduplicator, if needed
export const maybeScheduleNextTask = async (
	sendSQSBackfillMessage: (message, delay, logger) => Promise<SQS.SendMessageResult>,
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
		await sendSQSBackfillMessage(jobData, Math.ceil((delayMs || 0) / 1000), logger);
	}
};

const redis = new IORedis(getRedisInfo("installations-in-progress"));

const RETRY_DELAY_BASE_SEC = 60;

export const processInstallation = (sendSQSBackfillMessage: (message, delay, logger) => Promise<SQS.SendMessageResult>) => {
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
				() => doProcessInstallation(data, sentry, logger, (delayMs: number) =>
					nextTaskDelaysMs.push(delayMs)
				));

			switch (result) {
				case DeduplicatorResult.E_OK:
					logger.info("Job was executed by deduplicator");
					await maybeScheduleNextTask(sendSQSBackfillMessage, data, nextTaskDelaysMs, logger);
					break;
				case DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER: {
					logger.warn("Possible duplicate job was detected, rescheduling");
					await sendSQSBackfillMessage(data, RETRY_DELAY_BASE_SEC, logger);
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
					await sendSQSBackfillMessage(data, RETRY_DELAY_BASE_SEC + RETRY_DELAY_BASE_SEC * Math.random(), logger);
					break;
				}
			}
		} catch (err) {
			logger.error({ err }, "Process installation failed.");
			throw err;
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

const getBackfillSince = async (data: BackfillMessagePayload, log: Logger): Promise<Date | null | undefined> => {
	try {
		const commitSince = data.commitsFromDate ? new Date(data.commitsFromDate) : undefined;
		//set it to null on falsy value so that we can override db with sequlize
		return commitSince || null;
	} catch (e) {
		log.error({ err: e, commitsFromDate: data.commitsFromDate }, `Error parsing commitsFromDate in backfill message body`);
		//do not change anything
		return undefined;
	}
};
