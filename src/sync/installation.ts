/* eslint-disable @typescript-eslint/no-explicit-any */
import { intersection, omit, pick, without, cloneDeep } from "lodash";
import IORedis from "ioredis";
import Logger from "bunyan";
import { Subscription, SyncStatus } from "models/subscription";
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
import { isBlocked, numberFlag, NumberFlags, booleanFlag, BooleanFlags } from "config/feature-flags";
import { Deduplicator, DeduplicatorResult, RedisInProgressStorageWithTimeout } from "./deduplicator";
import { getRedisInfo } from "config/redis-info";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { Hub } from "@sentry/types/dist/hub";
import { getRepositoryTask } from "~/src/sync/discovery";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { Task, TaskResultPayload, TaskProcessors, TaskType } from "./sync.types";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";
import { getNextTasks } from "~/src/sync/scheduler";
import { getDependabotAlertTask } from "./dependabot-alerts";
import { getSecretScanningAlertTask } from "./secret-scanning-alerts";
import { getCodeScanningAlertTask } from "~/src/sync/code-scanning-alerts";

const tasks: TaskProcessors = {
	repository: getRepositoryTask,
	pull: getPullRequestTask,
	branch: getBranchTask,
	commit: getCommitTask,
	build: getBuildTask,
	deployment: getDeploymentTask,
	dependabotAlert: getDependabotAlertTask,
	secretScanningAlert: getSecretScanningAlertTask,
	codeScanningAlert: getCodeScanningAlertTask
};

const allTaskTypes: TaskType[] = ["pull", "branch", "commit", "build", "deployment", "dependabotAlert", "secretScanningAlert", "codeScanningAlert"];
const allTasksExceptBranch = without(allTaskTypes, "branch");

export const getTargetTasks = (targetTasks?: TaskType[]): TaskType[] => {
	if (targetTasks?.length) {
		return intersection(allTaskTypes, targetTasks);
	}

	// TODO: add a test to make sure sorting/shuffling of the returned data doesn't affect future invocations
	return cloneDeep(allTaskTypes);
};

export class TaskError extends Error {
	task: Task;
	cause: Error;
	constructor(task: Task, cause: Error) {
		super(cause.message);
		this.task = cloneDeep(task);
		this.cause = cause;
	}
}

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;
const getFromDateKey = (type: TaskType) => `${type}From`;

/**
 * Export for testing: TODO: test only public interface!!
 *
 * @param data
 * @param taskResultPayload - when edges.length is 0 or undefined, the task is considered to be completed
 * @param task
 * @param logger
 * @param sendBackfillMessage
 */
export const updateTaskStatusAndContinue = async (
	data: BackfillMessagePayload,
	taskResultPayload: TaskResultPayload,
	task: Task,
	logger: Logger,
	sendBackfillMessage: (message, delaySecs, logger) => Promise<unknown>,
	jiraHost?: string
): Promise<void> => {
	// Get a fresh subscription instance
	const subscription = await findSubscriptionForMessage(data);

	// handle promise rejection when an org is removed during a sync
	if (!subscription) {
		logger.info("Organization has been deleted. Other active syncs will continue.");
		return;
	}
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);
	const { edges } = taskResultPayload;
	const isComplete = !edges?.length;

	const status = isComplete ? "complete" : "pending";

	logger.info({ status }, "Updating job status");

	if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
		edges?.forEach((edge) => {
			if (edge?.node?.associatedPullRequests) {
				const { name, associatedPullRequests } = edge.node;
				logger.info({ name, associatedPullRequests }, "Sending branch data");
			}

			if (edge["workflow_runs"]) {
				edge["workflow_runs"].forEach((workflow) => {
					const { repository, event } = workflow;
					logger.info({ repositoryName: repository.name, eventType: event }, "Workflow run event");
				});
			}

			if (edge.state) {
				const { state, title, number, locked, auto_merge } = edge.state;
				logger.info({ state, title, number, locked, auto_merge }, "Sending PR data");
			}
		});
	}

	const updateRepoSyncFields: { [x: string]: string | Date} = { [getStatusKey(task.task)]: status };

	if (isComplete) {
		//Skip branches as it sync all history
		if (allTasksExceptBranch.includes(task.task) && data.commitsFromDate) {
			const repoSync = await RepoSyncState.findByRepoId(subscription, task.repositoryId);
			if (repoSync) {
				const newFromDate =  new Date(data.commitsFromDate);
				const existingFromDate = repoSync[getFromDateKey(task.task)];
				if (!existingFromDate || newFromDate.getTime() < existingFromDate.getTime()) {
					updateRepoSyncFields[getFromDateKey(task.task)] = newFromDate;
				}
			}
		}

		if (task.startTime) {
			statsd.histogram(metricTaskStatus.complete, Date.now() - task.startTime, { type: task.task, gitHubProduct }, { jiraHost: subscription.jiraHost });
		} else {
			logger.warn({ task }, "Fail to find startime in mainNextTask for metrics purpose");
		}
	} else {
		updateRepoSyncFields[getCursorKey(task.task)] = edges[edges.length - 1].cursor;
		if (task.startTime) {
			statsd.histogram(metricTaskStatus.pending, Date.now() - task.startTime, { type: task.task, gitHubProduct }, { jiraHost: subscription.jiraHost });
		} else {
			logger.warn({ task }, "Fail to find startime in mainNextTask for metrics purpose");
		}
	}

	await updateRepo(subscription, task.repositoryId, updateRepoSyncFields);
	await sendBackfillMessage(data, 0, logger);
};

/**
 * Determines if an an error returned by the GitHub API means that we should retry it
 * with a smaller request (i.e. with fewer pages).
 * @param err the error thrown by Octokit.
 */
export const isRetryableWithSmallerRequest = (err) =>
	err?.isRetryable || false;

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

const markSyncAsCompleteAndStop = async (data: BackfillMessagePayload, subscription: Subscription, logger: Logger) => {
	await subscription.update({
		syncStatus: SyncStatus.COMPLETE,
		backfillSince: getBackfillSince(data, logger)
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
		}, { jiraHost: subscription.jiraHost });
		await sendAnalytics(subscription.jiraHost, AnalyticsEventTypes.TrackEvent, {
			actionSubject: AnalyticsTrackEventsEnum.BackfullSyncOperationEventName,
			action: "complete",
			source: data.metricTags?.source || "worker"
		}, {
			...data.metricTags,
			gitHubProduct,
			durationInMinute: Math.ceil(timeDiff / (60 * 1000)),
			durationPerRepoInMinute: subscription.totalNumberOfRepos ? Math.ceil(timeDiff / (60 * 1000 * subscription.totalNumberOfRepos)) : undefined,
			reposBucket: repoCountToBucket(subscription.totalNumberOfRepos),
			reposCount: subscription.totalNumberOfRepos
		});
	}

	logger.info({ startTime, endTime, timeDiff, gitHubProduct }, "Sync status is complete");
};

const sendPayloadToJira = async (task: TaskType, jiraClient, subscription: Subscription, jiraPayload, repository: Task["repository"], sentry: Hub, logger: Logger) => {
	try {
		switch (task) {
			case "build":
				await jiraClient.workflow.submit(jiraPayload, repository.id, repository.full_name, {
					preventTransitions: true,
					operationType: "BACKFILL",
					auditLogsource: "BACKFILL",
					entityAction: "WORKFLOW_RUN",
					subscriptionId: subscription.id
				});
				break;
			case "deployment":
				await jiraClient.deployment.submit(jiraPayload, repository.id, repository.full_name, {
					preventTransitions: true,
					operationType: "BACKFILL",
					auditLogsource: "BACKFILL",
					subscriptionId: subscription.id
				});
				break;
			case "dependabotAlert":
			case "secretScanningAlert":
			case "codeScanningAlert": {
				await jiraClient.security.submitVulnerabilities(jiraPayload, {
					operationType: "BACKFILL"
				});
			}
				break;
			default:
				await jiraClient.devinfo.repository.update(jiraPayload, {
					preventTransitions: true,
					operationType: "BACKFILL",
					auditLogsource: "BACKFILL",
					entityAction: task.toUpperCase(),
					subscriptionId: subscription.id
				});
		}
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to send data to Jira");
		sendJiraFailureToSentry(err, sentry);
		throw err;
	}
};

const getTaskMetricsTags = (nextTask: Task) => {
	const metrics = {
		trigger: "backfill",
		subTrigger: nextTask.task
	};
	return metrics;
};

const isMainTask = (taskIndex: number) => taskIndex === 0;

const doProcessInstallation = async (data: BackfillMessagePayload, sentry: Hub, parentLogger: Logger, sendBackfillMessage: (message: BackfillMessagePayload, delaySecs: number, logger: Logger) => Promise<unknown>): Promise<void> => {
	const { installationId: gitHubInstallationId, jiraHost } = data;
	const subscription = await findSubscriptionForMessage(data);

	// TODO: should this reject instead? it's just ignoring an error
	if (!subscription) {
		parentLogger.warn("No subscription found. Exiting backfill");
		return;
	}

	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);
	const logger = parentLogger.child({
		gitHubProduct,
		startTime: data.startTime,
		commitsFromDate: data.commitsFromDate
	});

	// The idea is to always process the main task (the first one from the list) and handle its errors while do the
	// best effort for the other tasks (tail) that are picked randomly to use rate-limiting quota efficiently.
	const nextTasks = await getNextTasks(subscription, data.targetTasks || [], logger);
	if (!nextTasks.mainTask) {
		await markSyncAsCompleteAndStop(data, subscription, logger);
		return;
	}

	await subscription.update({ syncStatus: "ACTIVE" });

	const taskExecutor = async (nextTask: Task, sendBackfillMessage: (message: BackfillMessagePayload, delay: number, parentLogger: Logger) => Promise<unknown>, parentLogger: Logger) => {
		try {
			const logger = parentLogger.child({
				task: nextTask
			});

			logger.info("Starting task");
			nextTask.startTime = Date.now();

			const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraHost, getTaskMetricsTags(nextTask), logger, data.gitHubAppConfig?.gitHubAppId);

			const { task, cursor, repository } = nextTask;
			const processor = tasks[task];
			const nPages = Math.min(
				// "|| 20" is purely to simplify testing and avoid mocking it all the time
				await numberFlag(NumberFlags.BACKFILL_PAGE_SIZE, 20, jiraHost) || 20,
				// The majority of GitHub APIs hard-limit the page size to 100
				100
			);
			const taskPayload = await processor(logger, gitHubInstallationClient, jiraHost, repository, cursor, nPages, data);
			if (taskPayload.jiraPayload) {
				const jiraClient = await getJiraClient(
					subscription.jiraHost,
					gitHubInstallationId,
					data.gitHubAppConfig?.gitHubAppId,
					logger
				);
				await sendPayloadToJira(task, jiraClient, subscription, taskPayload.jiraPayload, repository, sentry, logger);
			}

			await updateTaskStatusAndContinue(
				data,
				taskPayload,
				nextTask,
				logger,
				sendBackfillMessage,
				jiraHost
			);
		} catch (err: unknown) {
			logger.warn({ err }, "Error while executing the task, rethrowing");
			throw err;
		}
	};

	const executors = [nextTasks.mainTask, ...nextTasks.otherTasks].map((nextTask, index) => taskExecutor(nextTask,
		isMainTask(index)
			// Only the first task is responsible for error handling, the other tasks are best-effort and not
			// supposed to schedule anything
			? sendBackfillMessage
			: () => Promise.resolve(),
		logger.child({ taskIndex: index })
	));

	const results = await Promise.allSettled(executors);
	const mainTaskResult = results[0];
	if (mainTaskResult.status === "rejected") {
		// Because scheduler deterministically returns the first task only, we treat it as the "main" one (that contributes
		// to retries etc). The others are treated as "best effort" and errors are ignored: in the worst case they will be
		// retried again
		const mainTask = nextTasks.mainTask;
		const errLogger = logger.child({
			err: mainTaskResult.reason,
			task: mainTask,
			taskIndex: 0
		});
		errLogger.info({ taskIndex: 0 }, "rethrowing as a task error");
		throw new TaskError(mainTask, mainTaskResult.reason);
	}
};

const findSubscriptionForMessage = (data: BackfillMessagePayload) =>
	Subscription.getSingleInstallation(
		data.jiraHost,
		data.installationId,
		data.gitHubAppConfig?.gitHubAppId
	);

export const markCurrentTaskAsFailedAndContinue = async (data: BackfillMessagePayload, mainNextTask: Task, isPermissionError: boolean, sendBackfillMessage: (message, delaySecs, logger, err: Error) => Promise<unknown>, log: Logger, err: Error): Promise<void> => {

	const subscription = await findSubscriptionForMessage(data);
	if (!subscription) {
		log.warn("No subscription found, nothing to do");
		return;
	}

	// marking the current task as failed, this value will override any preexisting failedCodes and only keep the last known failed issue.
	const failedCode = getFailedCode(err);
	log.warn({ failedCode }, "Backfill task failed.");

	// marking the current task as failed
	await updateRepo(subscription, mainNextTask.repositoryId, { [getStatusKey(mainNextTask.task)]: "failed", failedCode });
	const gitHubProduct = getCloudOrServerFromGitHubAppId(subscription.gitHubAppId);

	if (isPermissionError) {
		await updateRepo(subscription, mainNextTask.repositoryId, { failedCode: "PERMISSIONS_ERROR" });
		await subscription?.update({ syncWarning: `Invalid permissions for ${mainNextTask.task} task` });
		log.error(`Invalid permissions for ${mainNextTask.task} task`);
	}

	if (mainNextTask.startTime) {
		statsd.histogram(metricTaskStatus.failed, Date.now() - mainNextTask.startTime, { type: mainNextTask.task, gitHubProduct }, { jiraHost: subscription.jiraHost });
	} else {
		log.warn({ mainNextTask }, "Fail to find startime in mainNextTask for metrics purpose");
	}

	if (mainNextTask.task === "repository") {
		log.warn("Cannot finish discovery task: marking the subscription as FAILED");
		await subscription.update({ syncStatus: SyncStatus.FAILED });
		return;
	}
	await sendBackfillMessage(data, 0, log, err);
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

const redis = new IORedis(getRedisInfo("installations-in-progress"));

const RETRY_DELAY_BASE_SEC = 60;

export const processInstallation = (sendBackfillMessage: (message: BackfillMessagePayload, delaySecs: number, logger: Logger) => Promise<unknown>) => {
	const inProgressStorage = new RedisInProgressStorageWithTimeout(redis);
	const deduplicator = new Deduplicator(
		inProgressStorage, 1_000
	);

	return async (data: BackfillMessagePayload, sentry: Hub, logger: Logger): Promise<void> => {
		const { installationId, jiraHost } = data;
		const gitHubAppId: number | undefined = data.gitHubAppConfig?.gitHubAppId;

		logger.child({ gitHubInstallationId: installationId, jiraHost });

		try {
			if (await isBlocked(jiraHost, installationId, logger)) {
				logger.warn("blocking installation job");
				return;
			}

			sentry.setUser({
				gitHubInstallationId: installationId,
				jiraHost
			});

			let nextMessage: {
				payload: BackfillMessagePayload,
				delaySecs: number,
				logger: Logger
			} | undefined = undefined;

			const result = await deduplicator.executeWithDeduplication(
				`i-${installationId}-${jiraHost}-ghaid-${gitHubAppId || "cloud"}`,
				() => doProcessInstallation(data, sentry, logger, (message, delaySecs, logger) => {
					// We cannot send off the message straight away because otherwise it will be
					// de-duplicated as we are still processing the current message. Send it
					// only after deduplicator (tm) releases the flag.
					nextMessage = {
						payload: message,
						delaySecs: delaySecs,
						logger: logger
					};
					return Promise.resolve();
				})
			);

			const logAdditionalData = await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost);

			switch (result) {
				case DeduplicatorResult.E_OK:
					logAdditionalData ? logger.info({ installationId }, "Job was executed by deduplicator")
						: logger.info("Job was executed by deduplicator");
					if (nextMessage) {
						// The compiler doesn't know that nextMessage is defined here and thinks it is never
						// because it can't do control flow analysis of the async block of doProcessInstallation.
						nextMessage = nextMessage as { payload: BackfillMessagePayload, delaySecs: number, logger: Logger };
						logAdditionalData ? nextMessage.logger.info({ installationId }, "Sending off a new message")
							: nextMessage.logger.info("Sending off a new message");
						await sendBackfillMessage(nextMessage.payload, nextMessage.delaySecs, nextMessage.logger);
					}
					break;
				case DeduplicatorResult.E_NOT_SURE_TRY_AGAIN_LATER: {
					logAdditionalData ? logger.info({ installationId }, "Possible duplicate job was detected, rescheduling")
						: logger.info("Possible duplicate job was detected, rescheduling");
					await sendBackfillMessage(data, RETRY_DELAY_BASE_SEC, logger);
					break;
				}
				case DeduplicatorResult.E_OTHER_WORKER_DOING_THIS_JOB: {
					if (await booleanFlag(BooleanFlags.DELETE_MESSAGE_ON_BACKFILL_WHEN_OTHERS_WORKING_ON_IT, jiraHost)) {
						logger.warn("Duplicate job was detected, ff [delete_message_on_backfill_when_others_working_on_it] is ON, so deleting the message instead of rescheduling it");
						//doing nothing and return normally will endup delete the message.
						break;
					} else {
						logAdditionalData ? logger.info({ installationId }, "Duplicate job was detected, rescheduling")
							: logger.info("Duplicate job was detected, rescheduling");
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
						await sendBackfillMessage(data, RETRY_DELAY_BASE_SEC + RETRY_DELAY_BASE_SEC * Math.random(), logger);
						break;
					}
				}
			}
		} catch (err: unknown) {
			logger.error({ err, installationId }, "Process installation failed.");
			throw err;
		}
	};
};

const updateRepo = async (subscription: Subscription, repoId: number, values: Record<string, unknown>) => {
	const subscriptionRepoStateValues = pick(values, ["repositoryStatus", "repositoryCursor"]);
	const repoSyncStateValues = omit(values, ["repositoryStatus", "repositoryCursor"]);
	await Promise.all([
		Object.keys(subscriptionRepoStateValues).length && subscription.update(subscriptionRepoStateValues),
		Object.keys(repoSyncStateValues).length && RepoSyncState.updateRepoFromSubscription(subscription, repoId, repoSyncStateValues)
	]);
};

const getBackfillSince = (data: BackfillMessagePayload, log: Logger): Date | null | undefined => {
	try {
		const commitSince = data.commitsFromDate ? new Date(data.commitsFromDate) : undefined;
		//set it to null on falsy value so that we can override db with sequlize
		return commitSince || null;
	} catch (e: unknown) {
		log.error({ err: e, commitsFromDate: data.commitsFromDate }, `Error parsing commitsFromDate in backfill message body`);
		//do not change anything
		return undefined;
	}
};
