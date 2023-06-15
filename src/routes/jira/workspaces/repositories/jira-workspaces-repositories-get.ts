import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { getGitHubInstallationId } from "routes/jira/workspaces/jira-workspaces-get";
import sanitizeHtml from "sanitize-html";

export interface WorkspaceRepo {
	id: string,
	name: string,
	workspaceId: string
}

const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 20; // Number of items per page

const getReposForWorkspaceId = async (
	jiraHost: string,
	subscriptionId: number,
	page: number,
	limit: number,
	repoName?: string
): Promise<RepoSyncState[] | null> => {
	return await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(jiraHost, subscriptionId, page, limit, repoName);
};

const getAllRepos = async (
	jiraHost: string,
	subscriptions: Subscription[],
	page: number,
	limit: number,
	repoName?: string
): Promise<RepoSyncState[] | null> => {
	const subscriptionIds = subscriptions.map((subscription) => subscription.id);

	return RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(
		jiraHost,
		subscriptionIds,
		page,
		limit,
		repoName
	);
};

export const JiraWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to GET repositories");

	const { jiraHost } = res.locals;
	const subscriptionId = Number(sanitizeHtml(req.query?.workspaceId));
	const repoName = sanitizeHtml(req.query?.searchQuery as string);
	const page = Number(sanitizeHtml(req.query?.page)) || DEFAULT_PAGE_NUMBER;
	const limit = Number(sanitizeHtml(req.query?.limit)) || DEFAULT_LIMIT;
	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (!subscriptions.length) {
		req.log.warn(Errors.MISSING_SUBSCRIPTION);
		res.status(400).send(Errors.MISSING_SUBSCRIPTION);
		return;
	}

	const repos = subscriptionId ?
		await getReposForWorkspaceId(jiraHost, subscriptionId, page, limit, repoName) :
		await getAllRepos(jiraHost, subscriptions, page, limit, repoName);

	const repositories: WorkspaceRepo[] = repos ? repos.map((repo) => {
		const { repoId, repoName, subscriptionId, repoUrl } = repo;
		const gitHubInstallationId = getGitHubInstallationId(subscriptions, subscriptionId);
		const baseUrl = new URL(repoUrl).origin;

		return {
			id: transformRepositoryId(repoId, baseUrl),
			name: repoName,
			workspaceId: transformRepositoryId(gitHubInstallationId, baseUrl)
		};
	}) : [];

	res.status(200).json({
		success: true,
		repositories
	});
};
