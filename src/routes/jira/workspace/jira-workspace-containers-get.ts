import { Request, Response } from "express";
import { Errors } from "config/errors";

const { MISSING_JIRA_HOST } = Errors;

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
	// const connectedOrgId = req.query?.workspaceId as number;
	// const repoName = req.query?.searchQuery as string;
	// const repoName = "Atlassian-Org";



	res.status(200).json({ success: true });
};
