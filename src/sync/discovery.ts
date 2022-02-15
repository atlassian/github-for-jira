import { Subscription } from "../models";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import { Repositories, SyncStatus } from "../models/subscription";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { sqsQueues } from "../sqs/queues";

import GitHubClient from "../github/client/github-client";
import { getCloudInstallationId } from "../github/client/installation-id";

export const DISCOVERY_LOGGER_NAME = "sync.discovery";

export const discovery = (app: Application) => async (job, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;
	const github = await app.auth(installationId);
	enhanceOctokit(github);

	try {

		const repositoriesOld = await github.paginate(
			github.apps.listRepos.endpoint.merge({ per_page: 1 }),
			(res) => {
				return res.data.repositories;
			}
		);



		// Iterate thru request to get all repos
		// 
		// feature flag to use for USE_NEW_GH_CLIENT_FOR_DISCOVERY_QUEUE
		// create new LD
		// 
		// try admin endpoint ..... 

		// NEW GH CLIENT ==========================================================================
		const gh = new GitHubClient(getCloudInstallationId(installationId), logger);
		const repositories = await gh.getAllRepositories();
		// need to implenent iterator... e.g. handle 1000 repos
		// ========================================================================================

		logger.info(
			{ job },
			`${repositoriesOld.length} Repositories found - Octokit`
		);

		logger.info(
			{ job },
			`${repositories.length} Repositories found - Github client`
		);

		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationId
		);

		if(!subscription) {
			logger.info({jiraHost, installationId}, "Subscription has been removed, ignoring job.");
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
		const reposOld: Repositories = repositoriesOld.reduce((obj, repo) => {
			obj[repo.id] = { repository: getRepositorySummary(repo) };
			return obj;
		}, {});


		const repos: Repositories = repositories.reduce((obj, repository) => {
			obj[repository.id] = { repository };
			return obj;
		}, {});

		logger.info(
			{ repos: reposOld },
			"Repositories - Octokit"
		);

		logger.info(
			{ repos },
			"Repositories - Github client"
		);

		await subscription.updateSyncState({
			numberOfSyncedRepos: 0,
			repos
		});

		await sqsQueues.backfill.sendMessage({installationId, jiraHost, startTime: startTime.toISOString()}, 0, logger);
	} catch (err) {
		logger.error({ job, err }, "Discovery error");
	}
};
