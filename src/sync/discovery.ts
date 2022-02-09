import { Subscription } from "../models";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import { Repositories, SyncStatus } from "../models/subscription";
import {LoggerWithTarget} from "probot/lib/wrap-logger";
import { sqsQueues } from "../sqs/queues";

export const DISCOVERY_LOGGER_NAME = "sync.discovery";

export const discovery = (app: Application) => async (job, logger: LoggerWithTarget) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;
	const github = await app.auth(installationId); // use GHclient here
	enhanceOctokit(github);// whats this

	try {
		const repositories = await github.paginate(
			github.apps.listRepos.endpoint.merge({ per_page: 1 }),
			(res) => {
				console.log("PAGINATE CALLED");
				console.log(res);
				return res.data.repositories;
			}
		);
		logger.info(
			{ job },
			`${repositories.length} Repositories found`
		);

		console.log("WHAT THE REPO CALLED");
		console.log(repositories);
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
		const repos: Repositories = repositories.reduce((obj, repo) => {
			obj[repo.id] = { repository: getRepositorySummary(repo) };
			return obj;
		}, {});
		await subscription.updateSyncState({
			numberOfSyncedRepos: 0,
			repos
		});

		await sqsQueues.backfill.sendMessage({installationId, jiraHost, startTime: startTime.toISOString()}, 0, logger);
	} catch (err) {
		logger.error({ job, err }, "Discovery error");
	}
};
