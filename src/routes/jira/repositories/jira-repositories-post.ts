import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { BulkSubmitRepositoryInfo } from "interfaces/jira";
const { MISSING_JIRA_HOST } = Errors;

const findMatchingRepositories = async (repoIds: number[], jiraHost: string): Promise<(RepoSyncState | null)[]> => {
	const repos = await Promise.all(
		repoIds.map(async id => await RepoSyncState.findRepoById(id, jiraHost))
	);

	return repos.filter(repo => repo != null);
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

export const JiraRepositoriesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch repos");

	// const { jiraHost } = res.locals;
	const jiraHost = "https://rachellerathbone.atlassian.net";
	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const { ids: reposIds } = req.body;

	if (!reposIds) {
		const errMessage = "No repo IDs provided";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await findMatchingRepositories(reposIds, jiraHost);

	if (!repos.length) {
		const errMessage = "No matches found";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const transformedRepos = repos.map(repo => repo && transformedRepo(repo));

	const payload = {
		preventTransitions: false,
		operationType: "NORMAL",
		repositories: transformedRepos,
		properties: {
			installationId: 37093592 // TODO update this and check if there could be multiple... eek
		}
	};

	res.status(200).json({ success: true, payload });
};
