import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { RepoSyncState } from "~/src/models/reposyncstate";

export const ApiInstallationDelete = async (req: Request, res: Response): Promise<void> => {
	const gitHubInstallationId = req.params.installationId;
	const gitHubAppId = Number(req.params.gitHubAppId) || undefined;
	const jiraHost = req.params.jiraHost;

	if (req.query?.nukeAll) {
		const repos = (await RepoSyncState.findAll({}));
		for (let i =0; i < repos.length; i++) {
			const repo = repos[i];
			repo.commitStatus = "complete";
			repo.pullStatus = "complete";
			repo.branchStatus = "complete";
			repo.buildStatus = "complete";
			repo.deploymentStatus = "complete";
			await repo.save();
		}
		res.status(200).send("Done");
		return;
	}

	if (!jiraHost || !gitHubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	const subscription = await Subscription.getSingleInstallation(
		jiraHost,
		Number(gitHubInstallationId),
		gitHubAppId
	);

	if (!subscription) {
		req.log.debug("no subscription");
		res.sendStatus(404);
		return;
	}

	try {
		const jiraClient = await getJiraClient(jiraHost, Number(gitHubInstallationId), gitHubAppId, req.log);
		req.log.info({ jiraHost, gitHubInstallationId }, `Deleting DevInfo`);
		await jiraClient.devinfo.installation.delete(gitHubInstallationId);
		const shouldUseBackfillAlgoIncremental = await booleanFlag(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, jiraHost);
		if (shouldUseBackfillAlgoIncremental) {
			await RepoSyncState.resetSyncFromSubscription(subscription);
		}
		res.status(200).send(`DevInfo deleted for jiraHost: ${jiraHost} gitHubInstallationId: ${gitHubInstallationId}`);
	} catch (err) {
		res.status(500).json(err);
	}
};
