import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";
import { paginatedResponse } from "utils/paginate-response";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import sanitizeHtml from "sanitize-html";

export type Workspace = {
	id: string,
	name: string,
	canCreateContainer: boolean
}

const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 20; // Number of items per page\

export const getGitHubInstallationId = (subscriptions: Subscription[], subscriptionId: number): number => {
	const matchingSubscription = subscriptions.find(sub => sub.id === subscriptionId);
	if (matchingSubscription === undefined) {
		throw new Error("Could not find subscription");
	}
	return matchingSubscription.gitHubInstallationId;
};

const findMatchingOrgs = async (subscriptions: Subscription[], orgName?: string): Promise<Workspace[]> => {
	const matchingRepos = await Promise.all(subscriptions.map(async (subscription: Subscription) => {
		return orgName
			? await RepoSyncState.findByOrgNameAndSubscriptionId(subscription, orgName)
			: await RepoSyncState.findOneFromSubscription(subscription);
	}));

	const matchedOrgs = matchingRepos
		.filter((org): org is RepoSyncState => org !== null)
		.map(org => {
			const { subscriptionId, repoOwner, repoUrl } = org;
			const gitHubInstallationId = getGitHubInstallationId(subscriptions, subscriptionId);
			const baseUrl = new URL(repoUrl).origin;
			const transformedId = transformRepositoryId(gitHubInstallationId, baseUrl);

			return {
				id: transformedId,
				name: repoOwner,
				canCreateContainer: false
			};
		});

	return matchedOrgs;
};

export const JiraWorkspacesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for GET workspaces");

	const { jiraHost } = res.locals;
	const subscriptions = await Subscription.getAllForHost(jiraHost);

	if (!subscriptions.length) {
		req.log.warn({ jiraHost, req, res }, Errors.MISSING_SUBSCRIPTION);
		res.status(400).send(Errors.MISSING_SUBSCRIPTION);
		return;
	}

	const orgName = sanitizeHtml(req.query?.searchQuery as string);
	const page = Number(sanitizeHtml(req.query?.page as string ?? "undefined")) || DEFAULT_PAGE_NUMBER;
	const limit = Number(sanitizeHtml(req.query?.limit as string ?? "undefined")) || DEFAULT_LIMIT;

	const matchedOrgs = await findMatchingOrgs(subscriptions, orgName);

	res.status(200).json({ success: true, workspaces: paginatedResponse(page, limit, matchedOrgs) });
};
