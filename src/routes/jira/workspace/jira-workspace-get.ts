import { NextFunction, Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";

interface GitHubWorkspace {
	id: number,
	name: string,
	url: string,
	avatarUrl?: string
}

const { MISSING_JIRA_HOST, MISSING_GITHUB_SUBSCRIPTION } = Errors;

export const JiraWorkspaceGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
	const orgName = req.query?.searchQuery as string;
	// const orgName = "Atlassian-Org";

	if (!orgName) {
		const errMessage = "No org name provided in query";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return next();
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const matchedRepo: RepoSyncState[] = [];

	for await (const subscription of subscriptions) {
		const match = await RepoSyncState.findByOrgNameAndSubscriptionId(orgName, subscription);
		match !== null && matchedRepo.push(match);
	}

	if (!matchedRepo.length) {
		const errMessage = `Unable to find matching repo for ${orgName}`;
		res.status(400).send(errMessage);
		return;
	}

	const matchingSubscription = await Subscription.findByPk(matchedRepo[0].subscriptionId);

	if (!matchingSubscription) {
		req.log.warn(MISSING_GITHUB_SUBSCRIPTION);
		res.status(400).send(MISSING_GITHUB_SUBSCRIPTION);
		return;
	}

	const { gitHubInstallationId, avatarUrl } = matchingSubscription;
	const { repoUrl, repoName } = matchedRepo[0];
	const orgUrl = repoUrl.replace(repoName, "");

	const orgData: GitHubWorkspace = {
		id: gitHubInstallationId,
		name: orgName,
		url: orgUrl,
		avatarUrl
	};

	res.status(200).json({ success: true, orgData });
};
