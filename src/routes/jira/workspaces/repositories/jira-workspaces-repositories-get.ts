import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

const {
	MISSING_JIRA_HOST,
	MISSING_SUBSCRIPTION,
	MISSING_REPO_NAME,
	NO_MATCHING_REPOSITORIES
} = Errors;

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

const paginatedRepositories = (page: number, limit: number, repositories: WorkspaceRepo[]) => {
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;
	return repositories.slice(startIndex, endIndex);
};

export const JiraWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to GET repositories");

	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;
	const page = Number(req.query?.page) || 1; // Current page (default: 1)
	const limit = Number(req.query?.limit) || 20; // Number of items per page (default: 20)

	if (!repoName) {
		req.log.warn(MISSING_REPO_NAME);
		res.status(400).send(MISSING_REPO_NAME);
		return;
	}

	const repos = await findMatchingRepos(jiraHost, repoName, connectedOrgId);

	if (repos === null) {
		req.log.warn(MISSING_SUBSCRIPTION);
		res.status(400).send(MISSING_SUBSCRIPTION);
		return;
	}

	if (!repos?.length) {
		req.log.warn(NO_MATCHING_REPOSITORIES);
		res.status(400).send(NO_MATCHING_REPOSITORIES);
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
		repositories: paginatedRepositories(page, limit, repositories)
	});
};
