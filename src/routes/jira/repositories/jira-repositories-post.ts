import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
const { MISSING_JIRA_HOST } = Errors;

export interface GitHubRepo {
	id: number,
	name: string,
	providerName: string,
	url: string,
	avatarUrl: null,
	lastUpdatedDate?: Date
}

const findMatchingRepositories = async (repoIds: number[], jiraHost: string): Promise<(RepoSyncState | null)[]> => {
	const repos = await Promise.all(
		repoIds.map(async id => await RepoSyncState.findRepoById(id, jiraHost))
	);

	return repos.filter(repo => repo != null);
};

export const JiraRepositoriesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch repos");
	// const { jiraHost } = res.locals;
	const jiraHost = "https://rachelletest.atlassian.net";
	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const { ids: reposIds } = req.body;

	if (!reposIds) {
		const errMessage = "No repo ids provided";
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

	// transform to a list of repository entities matching the repository provider schema
	// (the format the GitHub for Jira app sends to data depot to ingest).

	res.status(200).json({ success: true, reposIds, repos });
};
