import { Repository, Subscription } from "models/subscription";
import { Task, TaskType } from "~/src/sync/sync.types";
import { RepoSyncState } from "models/reposyncstate";
import { getTargetTasks } from "~/src/sync/installation";
import { createInstallationClient } from "utils/get-github-client-config";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { Op } from "sequelize";
import { without } from "lodash";

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

// These numbers were obtained experimentally by syncing a large customer with 60K quota from GitHub
const RATE_LIMIT_QUOTA_PER_TASK_RESERVE = 500;
// Coefficient to determine pool size of the selection for the subtasks
const SUBTASKS_POOL_COEF = 10;

const MAX_SUBTASKS = 100;

const estimateNumberOfSubtasks = async (subscription: Subscription, logger: Logger) => {
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

		const nSubTasks = Math.min(allowedSubtasks, MAX_SUBTASKS);

		logger.info({ nSubTasks, rateLimitData }, `Using subtasks: ${nSubTasks}`);
		return nSubTasks;
	} catch (err: unknown) {
		logger.warn({ err }, "Cannot determine rate limit, return only main task");
		return 0;
	}
};

const mapSyncStateToTasks = (tasks: TaskType[], syncState: RepoSyncState): Task[] => {
	const mappedTasks: Task[] = [];
	tasks.forEach(
		(taskType) => {
			if (!syncState[getStatusKey(taskType)] || syncState[getStatusKey(taskType)] === "pending") {
				mappedTasks.push({
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
	return mappedTasks;
};

/**
 * Generates WHERE condition for RepoSyncStates table that would guarantee that there's at least one "pending" task
 * for the record
 */
const getLookupPendingConditionForTasks = (tasks: TaskType[]) => ({
	[Op.or]: tasks.map(task => {
		return {
			[Op.or]: [
				{
					[getStatusKey(task)]: null
				},
				{
					[getStatusKey(task)]: "pending"
				}
			]
		};
	})
});

/**
 * Returns records with at least one pending task for the given "tasks"
 */
const fetchPendingRepoSyncStates = (subscription: Subscription, tasks: TaskType[], limit: number) =>
	// Order by "id" to have strongly deterministic behaviour. Relying on something less definite (e.g. repoLastUpdated
	// that might be changed may result in a erroneous flicking between being the main task and a subtask, thus
	// slowing down the sync (when it is main, exponential retry is used; when it becomes subtask, other main task resets
	// retry counter)
	RepoSyncState.findAllFromSubscription(subscription, limit, 0, [["id", "DESC"]], {
		where: getLookupPendingConditionForTasks(tasks)
	});

/**
 *
 * @param repoSyncStatesWithPendingTasks - each record must contain at least one pending task for the given "tasks". The number of records should
 * 												 be large enough to fill up a pool of size (nSubTasks * SUBTASKS_POOL_COEF)
 * @param tasks
 * @param nSubTasks
 */
const calculateNextTasksWithSubtasks = (repoSyncStatesWithPendingTasks: RepoSyncState[], tasks: TaskType[], nSubTasks: number) => {
	let mainTask: Task | undefined = undefined;
	const otherTasks: Task[] = [];

	if (repoSyncStatesWithPendingTasks.length === 0) {
		return {
			mainTask: undefined,
			otherTasks: []
		};
	}

	for (const syncStateWithPendingTasks of repoSyncStatesWithPendingTasks) {
		const pendingTasks = mapSyncStateToTasks(tasks, syncStateWithPendingTasks);

		// The main task always comes first. This is guaranteed by the ordering, when we retrieve the records from Db.
		// It is very important: the sync will handle errors of the main task only (retries, SQS exponential backoff etc),
		// we must be sure that on retry the same error will be retried, not some other random task.
		if (!mainTask) {
			mainTask = pendingTasks[0];
			otherTasks.push(...pendingTasks.slice(1));
		} else {
			otherTasks.push(...pendingTasks);
		}

		// The pool size must be at least SUBTASKS_POOL_COEF times larger that the number of subtasks to make sure
		// we are not picking same tasks over and over again, to prevent retrying errors too many times.
		if (otherTasks.length > nSubTasks * SUBTASKS_POOL_COEF) {
			break;
		}
	}

	return {
		mainTask,
		otherTasks: otherTasks.sort(() => Math.random() - 0.5).slice(0, nSubTasks)
	};
};

/**
 *
 * @param subscription
 * @param targetTasks - the "mainTask" task is always same/deterministic! The "otherTasks" is random.
 * 											The caller can call this function after some delay again (e.g. SQS exponential backoff) and
 * 											expect to receive exactly same main task as during the previous call
 * @param logger
 */
export const getNextTasks = async (subscription: Subscription, targetTasks: TaskType[], logger: Logger): Promise<{
	mainTask: Task | undefined,
	otherTasks: Task[]
}> => {
	if (subscription.repositoryStatus !== "complete") {
		return {
			mainTask: {
				task: "repository",
				repositoryId: 0,
				repository: {} as Repository,
				cursor: subscription.repositoryCursor || undefined
			},
			otherTasks: []
		};
	}

	let tasks = getTargetTasks(targetTasks);
	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, subscription.jiraHost) || !subscription.isSecurityPermissionsAccepted) {
		tasks =  without(tasks, "dependabotAlert", "secretScanningAlert", "codeScanningAlert");
	}

	const nSubTasks = await estimateNumberOfSubtasks(subscription, logger);
	if (nSubTasks > 0) {
		const repoSyncStates = await fetchPendingRepoSyncStates(subscription, tasks, (nSubTasks + 1) * SUBTASKS_POOL_COEF);
		return calculateNextTasksWithSubtasks(repoSyncStates, tasks, nSubTasks);
	}

	const pendingRepoSyncState = await fetchPendingRepoSyncStates(subscription, tasks, 1);
	if (pendingRepoSyncState.length === 0) {
		return {
			mainTask: undefined,
			otherTasks: []
		};
	}
	return {
		// Both SQL and mapSyncStateToTasks are deterministic => mainTask is deterministic
		mainTask: mapSyncStateToTasks(tasks, pendingRepoSyncState[0])[0],
		otherTasks: []
	};

};
