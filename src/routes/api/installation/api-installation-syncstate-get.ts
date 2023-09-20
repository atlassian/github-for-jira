import { Request, Response } from "express";
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { pick } from "lodash";

export const ApiInstallationSyncstateGet = async (req: Request, res: Response): Promise<void> => {
	if (req.query.limit === undefined) {
		const msg = "Missing limit query param";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	if (req.query.offset === undefined) {
		const msg = "Missing offset query param";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

	const githubInstallationId = Number(req.params.installationId);
	const gitHubAppId = Number(req.params.gitHubAppId) || undefined;
	const jiraHost = req.params.jiraHost;
	const limit = Number(req.query.limit);
	const offset = Number(req.query.offset);

	if (limit > 10000) {
		const msg = "Max limit value is 10000";
		req.log.warn({ req, res }, msg);
		res.status(400).send(msg);
		return;
	}

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
			gitHubAppId
		);
		if (!subscription) {
			res.status(404).send(`No Subscription found for jiraHost "${jiraHost}" and installationId "${githubInstallationId}"`);
			return;
		}

		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, limit, offset, [["repoFullName", "ASC"]]);

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
