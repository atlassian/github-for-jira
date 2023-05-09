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

const findMatchingRepositories = async (repoIds: number[]): Promise<(RepoSyncState | null)[]> => {
	return await Promise.all(
		repoIds.map(async id => {
			const repo = await RepoSyncState.findRepoById(id);
			return repo;
		})
	);
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
		const errMessage = "No repo ids providers";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = findMatchingRepositories(reposIds);

	// get all repos from RepoSyncState by repoId

	// check returns repos subscriptionId and make sure jiraHost matches

	res.status(200).json({ success: true, reposIds, repos });
};
