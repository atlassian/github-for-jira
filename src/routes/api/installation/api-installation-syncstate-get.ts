import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { pick } from "lodash";

export const ApiInstallationSyncstateGet = async (req: Request, res: Response): Promise<void> => {
	const githubInstallationId = Number(req.params.installationId);
	const jiraHost = req.params.jiraHost;

	//TODO: ARC-1619 Maybe need to fix this and put it into the path
	//Not doing it now as it might break pollinator if it use this api
	const { gitHubAppIdStr } = req.query;

	if (!jiraHost || !githubInstallationId) {
		const msg = "Missing Jira Host or Installation ID";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	try {
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			githubInstallationId,
			parseInt(gitHubAppIdStr as string) || undefined
		);

		if (!subscription) {
			res.status(404).send(`No Subscription found for jiraHost "${jiraHost}" and installationId "${githubInstallationId}"`);
			return;
		}

		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription);

		res.json({
			jiraHost: subscription.jiraHost,
			gitHubInstallationId: subscription.gitHubInstallationId,
			numberOfSyncedRepos: subscription.numberOfSyncedRepos || 0,
			totalNumberOfRepos: repoSyncStates.length,
			repositories: repoSyncStates.map(repo => pick(repo,
				"branchStatus",
				"commitStatus",
				"pullStatus",
				"deploymentStatus",
				"buildStatus",
				"repoId",
				"repoName",
				"repoOwner",
				"repoFullName",
				"repoUrl",
				"repoPushedAt",
				"repoUpdatedAt",
				"repoCreatedAt"
			))
		});
	} catch (err) {
		res.status(500).json(err);
	}
};
