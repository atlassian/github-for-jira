import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";

export const JiraWorkspaceGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");

	// TODO - update this later
	// const { jiraHost } = res.locals;
	const jiraHost = "https://rachellerathbone.atlassian.net/";
	// TODO - update this later
	// const { orgName } = req.query;
	const orgName = "Atlassian-Org";

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, "Missing jiraHost");
		res.status(404).send(`Missing Jira Host '${jiraHost}'`);
		return;
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const thing = RepoSyncState.findByOrgNameAndSubscriptionId(orgName, subscriptions);
	req.log.info("THING", thing)


	res.status(200).json({ success: true });
};
