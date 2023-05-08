import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";

type GitHubWorkspace = {
	id: number,
	name: string,
	url: string,
	avatarUrl: string | undefined
}

type PartialGitHubWorkspace = Omit<GitHubWorkspace, "avatarUrl">;

const { MISSING_JIRA_HOST, MISSING_GITHUB_SUBSCRIPTION } = Errors;

const findMatchingOrgs = async (subscriptions: Subscription[], orgName: string): Promise<PartialGitHubWorkspace[]>  => {
	const matchingRepos = await RepoSyncState.findByOrgNameAndSubscriptionId(subscriptions, orgName);
	const matchedOrgs = matchingRepos.map(org => {
		const { subscriptionId, repoOwner, repoUrl, repoName } = org;
		const orgUrl = repoUrl.replace(`/${repoName}`, "");
		return {
			id: subscriptionId,
			name: repoOwner,
			url: orgUrl
		};
	})
		.filter((value, index, self) =>
			index === self.findIndex((org) => (
				org.id === value.id
			))
		);

	return matchedOrgs;
};

const getMatchingSubscriptions = async (orgs: PartialGitHubWorkspace[]): Promise<Awaited<GitHubWorkspace>[]> => {
	const matchedOrgs = await Promise.all(orgs.map(async org => {
		const matchingSubscription = await Subscription.findByPk(org.id);

		return {
			...org,
			avatarUrl: matchingSubscription?.avatarUrl
		};
	}));

	return matchedOrgs;
};

export const JiraWorkspaceGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");

	// TODO - update this later
	const { jiraHost } = res.locals;
	// const jiraHost = "https://rachellerathbone.atlassian.net";

	if (!jiraHost) {
		req.log.warn({ jiraHost, req, res }, MISSING_JIRA_HOST);
		res.status(400).send(MISSING_JIRA_HOST);
		return;
	}

	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (!subscriptions.length) {
		req.log.warn({ jiraHost, req, res }, MISSING_GITHUB_SUBSCRIPTION);
		res.status(400).send(MISSING_GITHUB_SUBSCRIPTION);
		return;
	}

	const orgName = req.query?.searchQuery as string;

	if (!orgName) {
		const errMessage = "No org name provided in query";
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const matchedOrgs = await findMatchingOrgs(subscriptions, orgName);

	if (!matchedOrgs?.length) {
		const errMessage = `Unable to find matching orgs for ${orgName}`;
		res.status(400).send(errMessage);
		return;
	}

	const matchingSubscriptions = await getMatchingSubscriptions(matchedOrgs);

	res.status(200).json({ success: true, workspaces: matchingSubscriptions });
};
