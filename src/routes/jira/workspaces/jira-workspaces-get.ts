import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";
import { paginatedResponse } from "utils/paginate-response";

export type Workspace = {
	id: string,
	name: string,
	canCreateContainer: boolean
}

const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 20; // Number of items per page

const findMatchingOrgs = async (subscriptions: Subscription[], orgName?: string): Promise<Workspace[]>  => {
	let matchingRepos;

	if (orgName) {
		matchingRepos = await Promise.all(subscriptions.map(async (subscription: Subscription) => {
			return await RepoSyncState.findByOrgNameAndSubscriptionId(subscription, orgName);
		}));
	} else {
		matchingRepos = await Promise.all(subscriptions.map(async (subscription: Subscription) => {
			return await RepoSyncState.findOneFromSubscription(subscription);
		}));
	}

	const matchedOrgs = matchingRepos
		.filter(org => org !== null)
		.map(org => {
			const { subscriptionId, repoOwner } = org;

			return {
				id: subscriptionId.toString(),
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

	const orgName = req.query?.searchQuery as string;
	const page = Number(req.query?.page) || DEFAULT_PAGE_NUMBER;
	const limit = Number(req.query?.limit) || DEFAULT_LIMIT;
	const matchedOrgs = await findMatchingOrgs(subscriptions, orgName);

	res.status(200).json({ success: true, workspaces: paginatedResponse(page, limit, matchedOrgs) });
};
