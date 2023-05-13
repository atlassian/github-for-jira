import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";
import { Subscription } from "models/subscription";
const { MISSING_JIRA_HOST } = Errors;

type RepoAndSubscription = RepoSyncState & Subscription;

const findMatchingRepository = async (id: number, jiraHost: string): Promise<(RepoAndSubscription | null)> => {
	return await RepoSyncState.findRepoByIdAndJiraHost(id, jiraHost);
};

const transformedRepo = (repo: RepoSyncState): BulkSubmitRepositoryInfo => {
	const { id, repoFullName, repoUrl } = repo;
	return {
		id: transformRepositoryId(id, undefined),
		name: repoFullName,
		url: repoUrl,
		updateSequenceId: Date.now()
	};
};

export const JiraWorkspacesRepositoriesAssociate = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for associate repository");

	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const { id: repoId } = req.body;

	if (!repoId) {
		const errMessage = "No repo IDs provided";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repo = await findMatchingRepository(Number(repoId), jiraHost);

	if (!repo) {
		const errMessage = "No matches found";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const transformedRepository = transformedRepo(repo);

	const payload = {
		preventTransitions: false,
		operationType: "NORMAL",
		repository: transformedRepository,
		properties: {
			installationId: repo.gitHubInstallationId
		}
	};

	res.status(200).json({ success: true, payload });
};
