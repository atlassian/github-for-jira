import { Subscription } from "../models";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import { Repositories, SyncStatus } from "../models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import sqsQueues from "../sqs/queues";
import { DiscoveryMessagePayload } from "../sqs/discovery";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { processRepoConfig } from "../config-as-code/repo-config-service";

export const DISCOVERY_LOGGER_NAME = "sync.discovery";

export const discovery = (app: Application) => async (job: DiscoveryMessagePayload, logger: LoggerWithTarget) => {
	if (job.repo) {
		// we want to extract the config from the repo's code base
		await discoverRepoConfig(job, logger);
	} else {
		// we want to get a list of all repos
		await discoverRepos(app, job, logger);
	}
};

/**
 * Calls out to a GitHub repo to check for the .jira/config.yml file and parses it, if available.
 */
const discoverRepoConfig = async (job: DiscoveryMessagePayload, logger: LoggerWithTarget) => {
	try {

		if (!job.repo) {
			logger.error({ job, }, "Error during discovery of single repository: repo data not available!");
			return;
		}

		await processRepoConfig(job.installationId, job.repo.owner, job.repo.name, job.repo.id);
	} catch (err) {
		logger.error({ job, err }, "Error during discovery of single repository.");
	}
}

/**
 * Gets the list of repositories from GitHub that we want to connect to this installation.
 */
const discoverRepos = async (app: Application, job: DiscoveryMessagePayload, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job;
	const github = await app.auth(installationId);
	enhanceOctokit(github);

	try {
		const repositories = await github.paginate(
			github.apps.listRepos.endpoint.merge({ per_page: 100 }),
			(res) => res.data.repositories
		);
		logger.info(
			{ job },
			`${repositories.length} Repositories found`
		);

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);

		if (!subscription) {
			logger.info({ jiraHost, installationId }, "Subscription has been removed, ignoring job.");
			return;
		}

		if (repositories.length === 0) {
			await subscription.update({
				syncStatus: SyncStatus.COMPLETE
			});
			return;
		}

		// Store the repository object to prevent doing an additional query in each job
		// Also, with an object per repository we can calculate which repos are synched or not
		const repos: Repositories = repositories.reduce((obj, repo) => {
			obj[repo.id] = { repository: getRepositorySummary(repo) };
			return obj;
		}, {});
		await subscription.updateSyncState({
			numberOfSyncedRepos: 0,
			repos
		});

		await sqsQueues.backfill.sendMessage({ installationId, jiraHost, startTime: startTime.toISOString() }, 0, logger);

		// schedule a message for each repo to check for the config file
		if (await booleanFlag(BooleanFlags.CONFIG_AS_CODE, false, jiraHost)) {
			for (const repo of repositories) {
				const payload = {
					installationId,
					jiraHost,
					repo: {
						id: repo.id,
						owner: repo.owner.login,
						name: repo.name
					}
				};
				logger.info({ payload, repo }, "scheduling repo discovery message")
				await sqsQueues.discovery.sendMessage(payload);
			}
		}

	} catch (err) {
		logger.error({ job, err }, "Error during discovery of repositories");
	}
}
