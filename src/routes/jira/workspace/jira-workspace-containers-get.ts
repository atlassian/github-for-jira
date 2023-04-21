import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";

const { MISSING_JIRA_HOST, MISSING_GITHUB_SUBSCRIPTION } = Errors;

interface GitHubRepo {
	id: number,
	name: string,
	providerName: string,
	url: string,
	avatarUrl: null,
	lastUpdatedDate: string
}

export const JiraWorkspaceContainersGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");

	// TODO - update this later
	const { jiraHost } = res.locals;
	// const jiraHost = "https://rachellerathbone.atlassian.net";

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	// TODO - update this later
	const connectedOrgId = Number(req.query?.workspaceId);
	const repoName = req.query?.searchQuery as string;
	// const repoName = "sandbox";

	if (!connectedOrgId || !repoName) {
		const errMessage = "Missing org ID or repo name";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscription = await Subscription.getOneForSubscriptionIdAndHost(jiraHost, connectedOrgId);

	if (!subscription) {
		req.log.warn(MISSING_GITHUB_SUBSCRIPTION);
		res.status(400).send(MISSING_GITHUB_SUBSCRIPTION);
		return;
	}

	const repoData: GitHubRepo = {
		id: 1,
		name: "name",
		providerName: "GitHub for Jira",
		url: "url",
		avatarUrl: null,
		lastUpdatedDate: "lastUpdatedDate"
	};

	res.status(200).json({ success: true, repoData });
};
