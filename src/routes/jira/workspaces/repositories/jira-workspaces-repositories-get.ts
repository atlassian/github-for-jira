import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

const { MISSING_JIRA_HOST, MISSING_SUBSCRIPTION } = Errors;

export interface WorkspaceRepo {
	id: string,
	name: string,
	workspaceId: string
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

const paginatedRepositories = (page: number, limit: number, repositories) => {
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;
	return repositories.slice(startIndex, endIndex);
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
	const page = Number(req.query?.page) || 1; // Current page (default: 1)
	const limit = Number(req.query?.limit) || 10; // Number of items per page (default: 10)

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

	const repositories: WorkspaceRepo[] = repos.map((repo) => ({
		id: repo.repoId.toString(),
		name: repo.repoName,
		workspaceId: repo.subscriptionId
	}));

	res.status(200).json({
		success: true,
		repositories: paginatedRepositories(page, limit, repositories)
	});
};
