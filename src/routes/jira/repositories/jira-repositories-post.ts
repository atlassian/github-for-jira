import { Request, Response } from "express";
import { Errors } from "config/errors";
const { MISSING_JIRA_HOST } = Errors;

export interface GitHubRepo {
	id: number,
	name: string,
	providerName: string,
	url: string,
	avatarUrl: null,
	lastUpdatedDate?: Date
}

export const JiraRepositoriesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch repos");
	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	// TODO - update this later
	const { id: repoIds } = req.body;
	// const repoIds = [];

	if (!repoIds) {
		const errMessage = "No repo ids providers";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	// get all repos from RepoSyncState by repoId

	// check returns repos subscriptionId and make sure jiraHost matches

	res.status(200).json({ success: true });
};
