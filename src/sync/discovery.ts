import { Subscription } from "../models";
import { getRepositorySummary } from "./jobs";
import enhanceOctokit from "../config/enhance-octokit";
import { Application } from "probot";
import { Repositories, SyncStatus } from "../models/subscription";
import { getLogger } from "../config/logger";
import { Queues } from "../worker/queues";

const logger = getLogger("sync.discovery");

export const discovery = (app: Application, queues: Queues) => async (job) => {
	const startTime = new Date();
	const { jiraHost, installationId } = job.data;
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

		// Create job
		queues.installation.add({ installationId, jiraHost, startTime });
	} catch (err) {
		logger.error({ job, err }, "Discovery error");
	}
};
