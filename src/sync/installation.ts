/* eslint-disable @typescript-eslint/no-explicit-any */
import SubscriptionClass, { Repositories, SyncStatus } from "../models/subscription";
import { Subscription } from "../models";
import getJiraClient from "../jira/client";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import statsd from "../config/statsd";
import getPullRequests from "./pull-request";
import getBranches from "./branches";
import getCommits from "./commits";
import { Application } from "probot";
import { metricHttpRequest, metricSyncStatus } from "../config/metric-names";
import { getLogger } from "../config/logger";

const logger = getLogger("sync.installation");

const tasks = {
	pull: getPullRequests,
	branch: getBranches,
	commit: getCommits
};
const taskTypes = Object.keys(tasks);

const updateNumberOfReposSynced = async (
	repos: Repositories,
	subscription: SubscriptionClass
): Promise<void> => {
	const repoIds = Object.keys(repos || {});
	if (!repoIds.length) {
		return;
	}

	const syncedRepos = repoIds.filter((id) => {
		// all 3 statuses need to be complete for a repo to be fully synced
		const { pullStatus, branchStatus, commitStatus } = repos[id];
		return (
			pullStatus === "complete" &&
			branchStatus === "complete" &&
			commitStatus === "complete"
		);
	});

	await subscription.update({
		repoSyncState: {
			...subscription.repoSyncState,
			numberOfSyncedRepos: syncedRepos.length
		}
	});
};

export const sortedRepos = (repos: Repositories) =>
	Object.entries(repos).sort(
		(a, b) =>
			new Date(b[1].repository?.updated_at).getTime() -
			new Date(a[1].repository?.updated_at).getTime()
	);

// TODO: type Task
const getNextTask = async (subscription: SubscriptionClass) => {
	const repos = subscription?.repoSyncState?.repos || {};
	await updateNumberOfReposSynced(repos, subscription);

	for (const [repositoryId, repoData] of sortedRepos(repos)) {
		const task = taskTypes.find(
			(taskType) => repoData[`${taskType}Status`] !== "complete"
		);
		if (!task) continue;
		const { repository, [getCursorKey(task)]: cursor } = repoData;
		return {
			task,
			repositoryId,
			repository,
			cursor
		};
	}
	return undefined;
};

const upperFirst = (str) =>
	str.substring(0, 1).toUpperCase() + str.substring(1);
const getCursorKey = (jobType) => `last${upperFirst(jobType)}Cursor`;

const updateJobStatus = async (
	queues,
	jiraClient,
	job,
	edges,
	task,
	repositoryId: string
) => {
	const { installationId, jiraHost } = job.data;
	// Get a fresh subscription instance
	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		installationId
	);

	// handle promise rejection when an org is removed during a sync
	if (subscription == null) {
		logger.info("Organization has been deleted. Other active syncs will continue.");
		return;
	}

	const status = edges.length > 0 ? "pending" : "complete";

	logger.info(
		`Updating job status for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}, status=${status}`
	);

	await subscription.updateSyncState({
		repos: {
			[repositoryId]: {
				[`${task}Status`]: status
			}
		}
	});

	if (edges.length > 0) {
		// there's more data to get
		await subscription.updateSyncState({
			repos: {
				[repositoryId]: {
					[getCursorKey(task)]: edges[edges.length - 1].cursor
				}
			}
		});

		const { removeOnComplete, removeOnFail } = job.opts;
		const delay = Number(process.env.LIMITER_PER_INSTALLATION) || 1000;

		queues.installation.add(job.data, {
			attempts: 3,
			delay,
			removeOnComplete,
			removeOnFail
		});
		// no more data (last page was processed of this job type)
	} else if (!(await getNextTask(subscription))) {
		await subscription.update({ syncStatus: SyncStatus.COMPLETE });
		let message = `Sync status for installationId=${installationId} is complete`;

		if (job.data.startTime !== undefined) {
			const endTime = Date.now();
			const timeDiff = endTime - Date.parse(job.data.startTime);
			message = `${message} startTime=${job.data.startTime} endTime=${endTime} diff=${timeDiff}`;

			// full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
			// startTime will be passed in when this sync job is queued from the discovery
			statsd.histogram(metricHttpRequest().fullSync, timeDiff);
		}

		logger.info(message);

		try {
			await jiraClient.devinfo.migration.complete();
		} catch (err) {
			logger.warn(err, "Error sending the `complete` event to JIRA");
		}
	} else {
		logger.info("Sync status for installationId=%d is pending", installationId);
		const { removeOnComplete, removeOnFail } = job.opts;

		queues.installation.add(job.data, {
			attempts: 3,
			removeOnComplete,
			removeOnFail
		});
	}
};

const getEnhancedGitHub = async (app: Application, installationId) =>
	enhanceOctokit(await app.auth(installationId));

// TODO: type queues
export const processInstallation =
	(app: Application, queues) =>
		async (job): Promise<void> => {
			const { installationId, jiraHost } = job.data;

			job.sentry.setUser({
				gitHubInstallationId: installationId,
				jiraHost
			});

			logger.info("Starting job for installationId=%d", installationId);

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
				logger.info("Sync complete: installationId=%d", installationId);
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
							repository: repository
						}
					}
				});
			}

			logger.info(
				`Starting task for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
			);

			const processor = tasks[task];

			// TODO: fix this function within function mess
			const pagedProcessor = (perPage) =>
				processor(github, repository, cursor, perPage);

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
				for (const perPage of [20, 10, 5, 1]) {
					try {
						return await pagedProcessor(perPage);
					} catch (err) {
						handleGitHubError(err);
					}
				}

				throw new Error(
					`Error processing GraphQL query: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
				);
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
					jiraClient,
					job,
					edges,
					task,
					repositoryId
				);
			} catch (err) {
				const rateLimit = Number(err?.headers?.["x-ratelimit-reset"]);
				const delay = Math.max(Date.now() - rateLimit * 1000, 0);

				if (delay) {
					// if not NaN or 0
					logger.info(
						`Delaying job for ${delay}ms installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
					);
					const { removeOnComplete, removeOnFail } = job.opts;
					queues.installation.add(job.data, {
						delay,
						removeOnComplete,
						removeOnFail
					});
					return;
				}

				if (String(err).includes("connect ETIMEDOUT")) {
					// There was a network connection issue.
					// Add the job back to the queue with a 5 second delay
					logger.warn(
						`ETIMEDOUT error, retrying in 5 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
					);
					const { removeOnComplete, removeOnFail } = job.opts;
					queues.installation.add(job.data, {
						delay: 5000,
						removeOnComplete,
						removeOnFail
					});
					return;
				}

				if (
					String(err.message).includes(
						"You have triggered an abuse detection mechanism"
					)
				) {
					// Too much server processing time, wait 60 seconds and try again
					logger.warn(
						`Abuse detection triggered. Retrying in 60 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
					);
					const { removeOnComplete, removeOnFail } = job.opts;
					queues.installation.add(job.data, {
						delay: 60000,
						removeOnComplete,
						removeOnFail
					});
					return;
				}
				// Checks if parsed error type is NOT_FOUND: https://github.com/octokit/graphql.js/tree/master#errors
				const isNotFoundError =
					err.errors &&
					err.errors.filter((error) => error.type === "NOT_FOUND").length;

				if (isNotFoundError) {
					logger.info(
						`Repository deleted after discovery, skipping initial sync: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`
					);

					const edgesLeft = []; // No edges left to process since the repository doesn't exist
					await updateJobStatus(
						queues,
						jiraClient,
						job,
						edgesLeft,
						task,
						repositoryId
					);
					return;
				}

				await subscription.update({ syncStatus: "FAILED" });

				logger.warn(err, `Sync failed: installationId=${installationId}`);

				job.sentry.setExtra("Installation FAILED", JSON.stringify(err, null, 2));
				job.sentry.captureException(err);

				statsd.increment(metricSyncStatus.failed);

				throw err;
			}
		};
