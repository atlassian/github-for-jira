import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { Errors } from "config/errors";
import { getLogger } from "config/logger";

// interface GitHubWorkspace {
// 	id: number,
// 	name: string,
// 	url: string,
// 	avatarUrl?: string
// }

const { MISSING_JIRA_HOST, MISSING_GITHUB_SUBSCRIPTION } = Errors;

const findMatchingOrgs = async (subscriptions: Subscription[], orgName: string): Promise<Subscription[]>  => {
	const matchingOrgs = await RepoSyncState.findByOrgNameAndSubscriptionId(subscriptions, orgName);;
	// for (const subscription of subscriptions) {
	// 	const orgs = await RepoSyncState.findByOrgNameAndSubscriptionId(subscription, orgName);
	// 	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// 	// @ts-ignore
	// 	matchingOrgs = orgs;
	// }
	// await RepoSyncState.findByOrgNameAndSubscriptionId(subscriptions, orgName);

	const logger = getLogger("test");
	// logger.info("orgs", orgs, orgName, subscriptions);

	// const matchedOrgs = orgs.map(org => {
	// 	const { subscriptionId, repoOwner, repoUrl, repoName } = org;
	// 	const orgUrl = repoUrl.replace(repoName, "");
	// 	return {
	// 		id: subscriptionId,
	// 		name: repoOwner,
	// 		url: orgUrl
	// 	};
	// })
	// 	.filter((value, index, self) =>
	// 		index === self.findIndex((org) => (
	// 			org.name === value.name
	// 		))
	// 	);

	logger.info(matchingOrgs);
	return subscriptions;
};

const getMatchingSubscriptions = async (orgs): Promise<Subscription[]> => {
	let matchingSubscriptions;

	for (const org of orgs) {
		matchingSubscriptions = await Subscription.findByPk(org.id);
	}

	const logger = getLogger("test");
	logger.info("");

	return matchingSubscriptions;
};

export const JiraWorkspaceGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for fetch org");

	// TODO - update this later
	// const { jiraHost } = res.locals;
	const jiraHost = "https://rachellerathbone.atlassian.net";

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

	// const subscriptionIds = subscriptions.map(sub => sub.id);
	const matchedOrgs = await findMatchingOrgs(subscriptions, orgName);

	// req.log.info("matchedOrgs", matchedOrgs);

	if (!matchedOrgs?.length) {
		const errMessage = `Unable to find matching orgs for ${orgName}`;
		res.status(400).send(errMessage);
		return;
	}

	const matchingSubscriptions = await getMatchingSubscriptions(matchedOrgs);

	if (!matchingSubscriptions) {
		req.log.warn(MISSING_GITHUB_SUBSCRIPTION);
		res.status(400).send(MISSING_GITHUB_SUBSCRIPTION);
		return;
	}

	const thing = matchedOrgs.map(async (org) => {
		// req.log.info("HERE", matchingSubscriptions);
		// req.log.info("FUCK", index);
		// const { avatarUrl } = matchingSubscriptions;
		const data = {
			...org
		};
		// req.log.info("DATA", data);
		return data;
	});

	// req.log.info("orgDATA", thing);

	res.status(200).json({ success: true, thing });
};
