import e, { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import notEmpty from "~/src/util/not-empty";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

interface Workspace {
	id: string;
	name: string;
	url: string;
	avatarUrl: string;
}

export const DEFAULT_AVATAR =
	"https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

const omitRepoNameFromUrl = (repoUrl: string, repoName: string): string => {
	if (repoUrl.endsWith(repoName)) {
		const segments = repoUrl.split("/");
		segments.pop();
		return segments.join("/");
	}
	throw Error(Errors.UNEXPECTED_REPOSITORY_URL_STRUCTURE);
};

const transformSubscriptions = async (
	subscriptionAndRepos: [Subscription, RepoSyncState][],
	logger: Logger
): Promise<Workspace[]> => {
	return subscriptionAndRepos
		.map(
			([
				{ avatarUrl, id: subscriptionId },
				{ repoOwner, repoUrl, repoName }
			]) => {
				try {
					return {
						id: String(subscriptionId),
						name: repoOwner,
						url: omitRepoNameFromUrl(repoUrl, repoName),
						avatarUrl: avatarUrl || DEFAULT_AVATAR
					};
				} catch (error: unknown) {
					logger.error(e);
					return undefined;
				}
			}
		)
		.filter(notEmpty);
};

const getSubscriptions = async (
	subscriptionIds: number[]
): Promise<Subscription[]> =>
	await Subscription.findAllForSubscriptionIds(subscriptionIds);

const getReposForSubscriptions = async (
	subscriptions: Subscription[]
): Promise<[Subscription, RepoSyncState][]> => {
	return (
		await Promise.all(
			subscriptions.map(async (sub) => {
				return [sub, await RepoSyncState.findOneFromSubscription(sub)] as [
					Subscription,
					RepoSyncState | null
				];
			})
		)
	).filter((value): value is [Subscription, RepoSyncState] =>
		notEmpty(value[1])
	);
};

const transformSubscriptionIds = (subscriptionIds: string[]): number[] => {
	// parse everything to Numbers, then filter elements that are NaN
	return subscriptionIds
		.map((maybeN) => Number(maybeN))
		.filter((n) => !isNaN(n));
};

export const JiraSecurityWorkspacesPost = async (
	req: Request,
	res: Response
): Promise<void> => {
	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, res.locals.jiraHost)) {
		res.status(403).send(Errors.FORBIDDEN_PATH);
		return;
	}

	const logger = req.log;
	req.log.info(
		{ method: req.method, requestUrl: req.originalUrl },
		"Request started for security POST workspaces"
	);

	const { ids: subscriptionIds } = req.body;

	if (!subscriptionIds) {
		const errMessage = Errors.MISSING_WORKSPACE_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscriptions = await getSubscriptions(
		transformSubscriptionIds(subscriptionIds)
	);
	const subscriptionAndRepos = await getReposForSubscriptions(subscriptions);

	const transformedSubscriptions = await transformSubscriptions(
		subscriptionAndRepos,
		logger
	);


	res.status(200).json({ success: true, workspaces: transformedSubscriptions });
};
