import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

const { MISSING_JIRA_HOST, MISSING_SUBSCRIPTION } = Errors;

export interface GitHubRepo {
	id: number,
	name: string
}

const findMatchingRepos = async (
	jiraHost: string,
	repoName: string,
	connectedOrgId: number | undefined
) => {
	let repos;

	if (connectedOrgId) {
		const subscription = await Subscription.getOneForSubscriptionIdAndHost(jiraHost, connectedOrgId);

		if (!subscription) {
			return null;
		}

		repos = await RepoSyncState.findRepositoriesBySubscriptionIdAndRepoName(subscription.id, repoName);
	} else {
		const subscriptions = await Subscription.getAllForHost(jiraHost);

		if (!subscriptions.length) {
			return null;
		}

		const reposArray = await Promise.all(subscriptions.map(async (subscription) => {
			return await RepoSyncState.findRepositoriesBySubscriptionIdAndRepoName(subscription.id, repoName);
		}));

		repos = reposArray.flat();
	}

	return repos;
};

export const JiraWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to get repositories");

	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;

	if (!repoName) {
		const errMessage = "Missing repo name";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await findMatchingRepos(jiraHost, repoName, connectedOrgId);

	if (repos === null) {
		req.log.warn(MISSING_SUBSCRIPTION);
		res.status(400).send(MISSING_SUBSCRIPTION);
		return;
	}

	if (!repos?.length) {
		const errMessage = "Repository not found";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repositories = repos.map(repo => {
		const { repoId, repoName: name, subscriptionId } = repo;

		return {
			id: repoId.toString(),
			name,
			workspaceId: subscriptionId
		};
	});

	res.status(200).json({ success: true, repositories });
};
