import { Repository, Subscription } from "models/subscription";
import { Task, TaskType } from "~/src/sync/sync.types";
import { RepoSyncState } from "models/reposyncstate";
import { getTargetTasks } from "~/src/sync/installation";
import { createInstallationClient } from "utils/get-github-client-config";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

const getCursorKey = (type: TaskType) => `${type}Cursor`;
const getStatusKey = (type: TaskType) => `${type}Status`;

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
	// Order on "id" is to have deterministic behaviour when there are records without "repoUpdatedAt"
	const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, { order: [["repoUpdatedAt", "DESC"], ["id", "DESC"]] });

	const withSideTasks = await booleanFlag(BooleanFlags.VERBOSE_LOGGING, subscription.jiraHost);

	let mainTask: Task | undefined = undefined;
	const otherTasks: Task[] = [];

	for (const syncState of repoSyncStates) {
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
		// they are best effort)
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

	const metrics = {
		trigger: "ratelimit_check_backfill"
	};
	const rateLimit = await (await createInstallationClient(subscription.gitHubInstallationId, subscription.jiraHost, metrics, logger, subscription.gitHubAppId)).getRateLimit();
	const availQuota = Math.min(rateLimit.data.resources.core.remaining, rateLimit.data.resources.graphql.remaining);
	const nSubTasks = Math.min(Math.floor(availQuota / 1000), 10);

	logger.info({ nSubTasks }, "Using " + nSubTasks + " subtasks");

	if (nSubTasks === 0) {
		return [mainTask];
	}

	return [mainTask, ...(
		otherTasks.sort(() => Math.random() - 0.5).slice(0, nSubTasks)
	)];

};
