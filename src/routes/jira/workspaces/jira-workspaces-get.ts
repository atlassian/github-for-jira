import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";

type GitHubWorkspace = {
	id: string,
	name: string
}

const {
	MISSING_JIRA_HOST,
	MISSING_SUBSCRIPTION,
	MISSING_ORG_NAME,
	NO_MATCHING_WORKSPACES
} = Errors;

const findMatchingOrgs = async (subscriptions: Subscription[], orgName: string): Promise<GitHubWorkspace[]>  => {
	const matchingRepos = await RepoSyncState.findByOrgNameAndSubscriptionId(subscriptions, orgName);
	const matchedOrgs = matchingRepos.map(org => {
		const { subscriptionId, repoOwner } = org;

		return {
			id: subscriptionId.toString(),
			name: repoOwner,
			// default to false until support is added for createContainer
			canCreateContainer: false
		};
	})
		.filter((value, index, self) =>
			index === self.findIndex((org) => (
				org.id === value.id
			))
		);

	return matchedOrgs;
};

export const JiraWorkspacesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for GET workspaces");

	const { jiraHost } = res.locals;

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (!subscriptions.length) {
		req.log.warn({ jiraHost, req, res }, MISSING_SUBSCRIPTION);
		res.status(400).send(MISSING_SUBSCRIPTION);
		return;
	}

	const orgName = req.query?.searchQuery as string;

	if (!orgName) {
		req.log.warn(MISSING_ORG_NAME);
		res.status(400).send(MISSING_ORG_NAME);
		return;
	}

	const matchedOrgs = await findMatchingOrgs(subscriptions, orgName);

	if (!matchedOrgs?.length) {
		res.status(400).send(NO_MATCHING_WORKSPACES);
		return;
	}

	res.status(200).json({ success: true, workspaces: matchedOrgs });
};
