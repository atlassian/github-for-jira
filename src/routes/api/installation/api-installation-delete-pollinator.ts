import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { isTestJiraHost } from "config/jira-test-site-check";

export const ApiInstallationDeleteForPollinator = async (req: Request, res: Response): Promise<void> => {
	const gitHubInstallationId = req.params.installationId;
	const gitHubAppId = Number(req.params.gitHubAppId) || undefined;
	const jiraHost = req.params.jiraHost;

	if (!jiraHost || !gitHubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	if (!isTestJiraHost(jiraHost)) {
		const msg = "Jira Host not a pollinator jira site";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	const subscription: Subscription | null = await Subscription.getSingleInstallation(
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

		if (!jiraClient) {
			req.log.info("Halting further execution for delete DevInfo as JiraClient is empty for this installation");
			throw new Error("Unable to get Jira client for undefined githubAppId");
		}

		req.log.info({ jiraHost, gitHubInstallationId }, "Deleting DevInfo");
		await jiraClient.devinfo.installation.delete(gitHubInstallationId);
		await subscription.update({
			syncStatus: null,
			syncWarning: null,
			backfillSince: null,
			totalNumberOfRepos: null,
			numberOfSyncedRepos: null,
			repositoryCursor: null,
			repositoryStatus: null
		});
		await RepoSyncState.deleteFromSubscription(subscription);
		res.status(200).send(`DevInfo deleted for jiraHost: ${jiraHost} gitHubInstallationId: ${gitHubInstallationId}`);
	} catch (err: unknown) {
		res.status(500).json(err);
	}
};
