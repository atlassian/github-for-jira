import { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import {
	getRepoUrlAndRepoId, transformRepositories
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-post";
import { RepoSyncStateAndSubscription } from "models/reposyncstate";

const getRepos = async (gitHubInstallationId: string, repoName: string): Promise<RepoSyncStateAndSubscription[]> => {
	const { id } = getRepoUrlAndRepoId(gitHubInstallationId);
	const results = await Subscription.findAllForGitHubInstallationIdAndRepoName(Number(id), repoName);

	return results.filter((result) => result != null) as RepoSyncStateAndSubscription[];
};

export const JiraSecurityWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for security GET repositories");

	const gitHubInstallationId = sanitizeHtml(req.query?.workspaceId as string);

	if (!gitHubInstallationId) {
		const errMessage = Errors.MISSING_WORKSPACE_ID;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repoName = sanitizeHtml(req.query?.searchQuery as string);

	if (!repoName) {
		const errMessage = Errors.MISSING_CONTAINER_NAME;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await getRepos(gitHubInstallationId, repoName);
	const transformedRepositories = repos.length ?
		await transformRepositories(repos) : [];

	res.status(200).json({
		success: true,
		containers: transformedRepositories
	});
};
