import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState, RepoSyncStateProperties } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";
import { Subscription } from "models/subscription";

type RepoAndSubscription = RepoSyncState & Subscription;

const findMatchingRepository = async (id: number, jiraHost: string): Promise<(RepoAndSubscription | null)> => {
	return await RepoSyncState.findRepoByRepoIdAndJiraHost(id, jiraHost);
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

	const repo = await findMatchingRepository(Number(repoId), jiraHost);
	const transformedRepository = repo ? transformedRepo(repo): {};

	const payload = {
		preventTransitions: false,
		operationType: "NORMAL",
		repository: transformedRepository,
		properties: {
			installationId: repo?.gitHubInstallationId
		}
	};

	res.status(200).json({ success: true, associatedRepository: payload });
};
