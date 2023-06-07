import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

export interface WorkspaceRepo {
	id: string,
	name: string,
	workspaceId: string
}

const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 20; // Number of items per page

const getReposForWorkspaceId = async (
	connectedOrgId: number,
	page: number,
	limit: number,
	repoName?: string
): Promise<RepoSyncState[] | null> => {
	return await RepoSyncState.findRepositoriesBySubscriptionIdAndRepoName(connectedOrgId, page, limit, repoName);
};

const getAllRepos = async (
	subscriptions: Subscription[],
	page: number,
	limit: number,
	repoName?: string
): Promise<RepoSyncState[] | null> => {

	const reposArray: RepoSyncState[][] = await Promise.all(
		subscriptions.map(async (subscription) => {
			const subscriptionRepos = await RepoSyncState.findRepositoriesBySubscriptionIdAndRepoName(
				subscription.id,
				page,
				limit,
				repoName
			);
			return subscriptionRepos ? subscriptionRepos : [];
		})
	);

	return reposArray.flat().slice(0, limit); // Apply limit after flattening the array
};

export const JiraWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to GET repositories");

	const { jiraHost } = res.locals;
	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;
	const page = Number(req.query?.page) || DEFAULT_PAGE_NUMBER;
	const limit = Number(req.query?.limit) || DEFAULT_LIMIT;

	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (!subscriptions.length) {
		req.log.warn(Errors.MISSING_SUBSCRIPTION);
		res.status(400).send(Errors.MISSING_SUBSCRIPTION);
		return;
	}

	const repos = connectedOrgId ?
		await getReposForWorkspaceId(connectedOrgId, page, limit, repoName) :
		await getAllRepos(subscriptions, page, limit, repoName);

	const repositories: WorkspaceRepo[] = repos ? repos.map((repo) => {
		const { repoId, repoName, subscriptionId } = repo;
		return {
			id: repoId.toString(),
			name: repoName,
			workspaceId: subscriptionId.toString()
		};
	}) : [];

	res.status(200).json({
		success: true,
		repositories
	});
};
