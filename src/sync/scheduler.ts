import { Repository, Subscription } from "models/subscription";
import { Task, TaskType } from "~/src/sync/sync.types";
import { RepoSyncState } from "models/reposyncstate";
import { getTargetTasks } from "~/src/sync/installation";
import { createInstallationClient } from "utils/get-github-client-config";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

// These numbers were obtained experimentally by syncing a large customer with 60K quota from GitHub
const RATE_LIMIT_QUOTA_PER_TASK_RESERVE = 500;
const MAX_NUMBER_OF_SUBTASKS = 100;
const SUBTASKS_POLL_MAX_SIZE = MAX_NUMBER_OF_SUBTASKS * 10;

/**
 *
 * @param subscription
 * @param logger
 * @param mainTask
 * @param otherTasks - the array will be shuffled after the call, BEWARE!
 */
const calculateTasksUsingGitHubRateLimitQuota = async (subscription: Subscription, logger: Logger, mainTask: Task, otherTasks: Task[]) => {
	try {
		const metrics = {
			trigger: "ratelimit_check_backfill"
		};
		const rateLimitResponse = await (await createInstallationClient(subscription.gitHubInstallationId, subscription.jiraHost, metrics, logger, subscription.gitHubAppId)).getRateLimit();
		const rateLimitData = rateLimitResponse.data;

		const availQuota = Math.min(rateLimitData.resources.core.remaining, rateLimitData.resources.graphql.remaining);
		// We need to reserve some quota for the main task, too
		const availQuotaForSubtasks = Math.max(0, availQuota - RATE_LIMIT_QUOTA_PER_TASK_RESERVE);
		const allowedSubtasks = Math.floor(availQuotaForSubtasks / RATE_LIMIT_QUOTA_PER_TASK_RESERVE);

		const nSubTasks = Math.min(allowedSubtasks, MAX_NUMBER_OF_SUBTASKS);

		logger.info({ nSubTasks, rateLimitData }, `Using subtasks: ${nSubTasks}`);

		if (nSubTasks === 0) {
			return [mainTask];
		}

		return [mainTask, ...(
			otherTasks.sort(() => Math.random() - 0.5).slice(0, nSubTasks)
		)];
	} catch (err) {
		logger.warn({ err }, "Cannot determine rate limit, return only main task");
		return [mainTask];
	}
};

const mapSyncStateToTasks = (tasks: TaskType[], syncState: RepoSyncState): Task[] => {
	const ret: Task[] = [];
	tasks.forEach(
		(taskType) => {
			if (!syncState[getStatusKey(taskType)] || syncState[getStatusKey(taskType)] === "pending") {
				ret.push({
					task: taskType,
					repositoryId: syncState.repoId,
					repository: {
						id: syncState.repoId,
						name: syncState.repoName,
						full_name: syncState.repoFullName,
						owner: { login: syncState.repoOwner },
						html_url: syncState.repoUrl,
						updated_at: syncState.repoUpdatedAt?.toISOString()
					},
					cursor: syncState[getCursorKey(taskType)] || undefined
				});
			}
		}
	);
	return ret;
};

/**
 *
 * @param subscription
 * @param targetTasks - the first task is always same/deterministic! The tail is random from not complete ones tasks.
 * 											The caller can call this function after some delay again (e.g. SQS exponential backoff) and
 * 											it is guaranteed they will receive same task as the very first one (a.k.a. "main task")
 * @param logger
 */
export const getNextTasks = async (subscription: Subscription, targetTasks: TaskType[], logger: Logger): Promise<Task[]> => {
	if (subscription.repositoryStatus !== "complete") {
		return [{
			task: "repository",
			repositoryId: 0,
			repository: {} as Repository,
			cursor: subscription.repositoryCursor || undefined
		}];
	}

	const tasks = getTargetTasks(targetTasks);

	// Order by "id" to have strongly deterministic behaviour. Relying on something less definite (e.g. repoLastUpdated
	// that might be changed may result in a erroneous flicking between being the main task and a subtask, thus
	// slowing down the sync (when it is main, exponential retry is used; when it becomes subtask, other main task resets
	// retry counter)
	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, { order: [["id", "DESC"]] });

	const withSideTasks = await booleanFlag(BooleanFlags.USE_SUBTASKS_FOR_BACKFILL, subscription.jiraHost);

	let mainTask: Task | undefined = undefined;
	const otherTasks: Task[] = [];

	for (const syncState of repoSyncStates) {
		const syncStateTasks = mapSyncStateToTasks(tasks, syncState);

		if (syncStateTasks.length === 0) {
			continue;
		}

		if (!withSideTasks) {
			return [syncStateTasks[0]];
		}

		// The main task always comes first. This is guaranteed by the ordering, when we retrieve the records from Db.
		// It is very important: the sync will handle errors of the main task only (retries, SQS exponential backoff etc),
		// we must be sure that on retry the same error will be retried, not some other random task.
		if (!mainTask) {
			mainTask = syncStateTasks[0];
			otherTasks.push(...syncStateTasks.slice((1)));
		} else {
			otherTasks.push(...syncStateTasks);
		}

		// To prevent churn: in case of a large number of repos we want to process those subtasks that soon will become
		// the main one, otherwise a cursor might become invalid
		if (otherTasks.length > SUBTASKS_POLL_MAX_SIZE) {
			break;
		}
	}

	if (!mainTask) {
		return [];
	}

	if (otherTasks.length == 0) {
		return [mainTask];
	}

	return await calculateTasksUsingGitHubRateLimitQuota(subscription, logger, mainTask, otherTasks);
};
