import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

const { MISSING_JIRA_HOST, MISSING_SUBSCRIPTION } = Errors;

export interface GitHubRepo {
	id: number,
	name: string,
	providerName: string,
	url: string,
	avatarUrl: null,
	lastUpdatedDate?: Date
}

export const JiraRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to get repositories");

	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	// TODO - update this later
	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;

	if (!connectedOrgId || !repoName) {
		const errMessage = "Missing org ID or repo name";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscription = await Subscription.getOneForSubscriptionIdAndHost(jiraHost, connectedOrgId);

	if (!subscription) {
		req.log.warn(MISSING_SUBSCRIPTION);
		res.status(400).send(MISSING_SUBSCRIPTION);
		return;
	}

	const repos = await RepoSyncState.findRepositoriesBySubscriptionIdAndRepoName(subscription.id, repoName);
	req.log.info("REPOS: ", repos)
	if (!repos?.length) {
		const errMessage = "Repository not found";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repositories = repos.map(repo => {
		const { id, repoName: name } = repo;

		return {
			id,
			name
		};
	});

	res.status(200).json({ success: true, repositories });
};
