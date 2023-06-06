import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { paginatedResponse } from "utils/paginate-response";

export interface WorkspaceRepo {
	id: string,
	name: string,
	workspaceId: string
}

const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 20; // Number of items per page

const findMatchingRepos = async (
	jiraHost: string,
	repoName: string | undefined,
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
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to GET repositories");

	const { jiraHost } = res.locals;
	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;
	const page = Number(req.query?.page) || DEFAULT_PAGE_NUMBER;
	const limit = Number(req.query?.limit) || DEFAULT_LIMIT;

	const repos = await findMatchingRepos(jiraHost, repoName, connectedOrgId);

	if (repos === null) {
		req.log.warn(Errors.MISSING_SUBSCRIPTION);
		res.status(400).send(Errors.MISSING_SUBSCRIPTION);
		return;
	}

	const repositories: WorkspaceRepo[] = repos.map((repo) => {
		const repoId = transformRepositoryId(repo.repoId);
		const { repoName, subscriptionId } = repo;
		return {
			id: repoId.toString(),
			name: repoName,
			workspaceId: subscriptionId.toString()
		};
	});

	res.status(200).json({
		success: true,
		repositories: paginatedResponse(page, limit, repositories)
	});
};
