import { Request, Response } from "express";
import { Errors } from "config/errors";
import { RepoSyncState } from "models/reposyncstate";
import sanitizeHtml from "sanitize-html";
import { transformRepositories } from "./jira-security-workspaces-containers-post";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const JiraSecurityWorkspacesContainersSearchGet = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost } = res.locals;

	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost)) {
		res.status(403).send(Errors.FORBIDDEN_PATH);
		return;
	}

	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for security GET repositories");

	if (!req.query.workspaceId) {
		const errMessage = Errors.MISSING_WORKSPACE_ID;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscriptionId = req.query.workspaceId as unknown as number;
	const repoName = sanitizeHtml(req.query.searchQuery as string);

	// Fetch first 200 repos only
	const repos = await RepoSyncState.findRepositoriesBySubscriptionIdsAndRepoName(jiraHost, subscriptionId, 1, 200, repoName);
	const transformedRepositories = repos?.length ? await transformRepositories(repos) : [];

	res.status(200).json({
		success: true,
		containers: transformedRepositories
	});
};
