import { Repository, Subscription } from "models/subscription";
import { Task, TaskType } from "~/src/sync/sync.types";
import { RepoSyncState } from "models/reposyncstate";
import { getTargetTasks } from "~/src/sync/installation";
import { createInstallationClient } from "utils/get-github-client-config";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

const RATE_LIMIT_QUOTA_PER_TASK_RESERVE = 750;
const MAX_NUMBER_OF_SUBTASKS = 40;

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
		// We need to reserve for the main task
		const availQuotaForSubtasks = Math.max(0, availQuota - RATE_LIMIT_QUOTA_PER_TASK_RESERVE);
		const allowedSubtasks = Math.floor(availQuotaForSubtasks / RATE_LIMIT_QUOTA_PER_TASK_RESERVE);

		const nSubTasks = Math.min(allowedSubtasks, MAX_NUMBER_OF_SUBTASKS);

		logger.info({ nSubTasks, rateLimitData }, "Using subtasks: " + nSubTasks);

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

/**
 *
 * @param subscription
 * @param targetTasks - the first task is always deterministic! The tail is random from not complete ones
 * @param logger
 */
export const getNextTask = async (subscription: Subscription, targetTasks: TaskType[], logger: Logger): Promise<Task[]> => {
	if (subscription.repositoryStatus !== "complete") {
		return [{
			task: "repository",
			repositoryId: 0,
			repository: {} as Repository,
			cursor: subscription.repositoryCursor || undefined
		}];
	}

	const tasks = getTargetTasks(targetTasks);
	// Order on "id" is to have strongly deterministic behaviour. Relying on something less definite (e.g. repoLastUpdated)
	// may result in a error being retried with a different (good) task, thus resetting the retry counter
	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, { order: [["id", "DESC"]] });

	const withSideTasks = await booleanFlag(BooleanFlags.USE_SUBTASKS_FOR_BACKFILL, subscription.jiraHost);

	let mainTask: Task | undefined = undefined;
	const otherTasks: Task[] = [];

	for (const syncState of repoSyncStates) {
		if (mainTask) {
			// To make sure that PRs are not always coming first, because they are too greedy in terms of rate-limiting.
			// However the main task must always remain same, therefore only for other tasks
			tasks.sort(() => Math.random() - 0.5);
		}
		const task = tasks.find(
			(taskType) => !syncState[getStatusKey(taskType)] || syncState[getStatusKey(taskType)] === "pending"
		);
		if (!task) continue;

		const mappedTask = {
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

		if (!withSideTasks) {
			return [mappedTask];
		}

		// The main task is always goes first. This is guaranteed by the ordering when we retrieve the records from Db.
		// This is important for the sync to always look only at the error of the first task (and ignore the rest as
		// they are best effort only)
		if (!mainTask) {
			mainTask = mappedTask;
		} else {
			otherTasks.push(mappedTask);
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
