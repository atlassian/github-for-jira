import { NextFunction, Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSync, RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";

interface GitHubWorkspace {
	id: number,
	name: string,
	url: string,
	avatarUrl: string
}

export const JiraWorkspaceGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");

	// TODO - update this later
	// const { jiraHost } = res.locals;
	const jiraHost = "https://rachellerathbone.atlassian.net";
	// TODO - update this later
	// const { searchQuery } = req.query;
	const orgName = "Atlassian-Org";

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, Errors.MISSING_JIRA_HOST);
		res.status(404).send(Errors.MISSING_JIRA_HOST);
		return;
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const matchedRepo: RepoSync[] = [];

	for await (const subscription of subscriptions) {
		const match = await RepoSyncState.findByOrgNameAndSubscriptionId(orgName, subscription);
		match !== null && matchedRepo.push(match);
	}

	if (!matchedRepo) {
		const errMessage = `Unable to find matching repo for ${orgName}`;
		req.log.warn(errMessage);
		return next(errMessage);
	}

	const matchingSubscription = await Subscription.findByPk(matchedRepo[0]?.subscriptionId);

	if (!matchingSubscription) {
		req.log.warn(Errors.MISSING_GITHUB_SUBSCRIPTION);
		return next(new Error(Errors.MISSING_GITHUB_SUBSCRIPTION));
	}

	const { gitHubInstallationId } = matchingSubscription;
	const { repoUrl, repoName } = matchedRepo[0];
	const orgUrl = repoUrl.replace(repoName, "");

	const orgData: GitHubWorkspace = {
		id: gitHubInstallationId,
		name: orgName,
		url: orgUrl,
		avatarUrl: ""
	};

	res.status(200).json({ success: true, orgData });
};
