import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState, RepoSyncStateProperties } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";
import { Subscription } from "models/subscription";
import sanitizeHtml from "sanitize-html";

type RepoAndSubscription = RepoSyncState & Subscription;

const splitServerId = (input: string): string => {
	const parts: string[] = input.split("-");
	return parts[1];
};

const getRepoIdForCloudAndServer = (id: string): { id: number } => {
	if (id.includes("-")) {
		const repoId = splitServerId(id);
		return { id: parseInt(repoId) };
	} else {
		return { id: parseInt(id) };
	}
};

const findMatchingRepository = async (id: string, jiraHost: string): Promise<(RepoAndSubscription | null)> => {
	const { id: repoId } = getRepoIdForCloudAndServer(id);
	return await RepoSyncState.findRepoByRepoIdAndJiraHost(repoId, jiraHost);
};

const transformedRepo = (repo: RepoSyncStateProperties): BulkSubmitRepositoryInfo => {
	const { repoId, repoFullName, repoUrl } = repo;
	const baseUrl = new URL(repoUrl).origin;

	return {
		id: transformRepositoryId(repoId, baseUrl),
		name: repoFullName,
		url: repoUrl,
		updateSequenceId: Date.now()
	};
};

export const JiraWorkspacesRepositoriesAssociate = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for associate repository");

	const { jiraHost } = res.locals;
	const { id: repoId } = req.body;

	if (!repoId) {
		const errMessage = Errors.MISSING_REPOSITORY_ID;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repo = await findMatchingRepository(sanitizeHtml(repoId), jiraHost);
	const transformedRepository = repo && transformedRepo(repo);

	if (repo) {
		res.status(200).json({ success: true, associatedRepository: transformedRepository });
	} else {
		res.status(404).send(Errors.REPOSITORY_NOT_FOUND);
	}
};
