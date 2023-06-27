import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { RepoSyncState } from "models/reposyncstate";

interface Workspace {
	id: string,
	name: string,
	url: string,
	avatarUrl: string
}

const omitRepoNameFromUrl = (url: string): string => {
	const segments = url.split("/");
	segments.pop(); // Remove the last segment
	return segments.join("/");
};

const transformSubscriptions = async (
	subscriptions: Subscription[],
	jiraHost: string
): Promise<Workspace[]> => {
	const matchedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
		return sub &&  await RepoSyncState.findBySubscriptionIdAndJiraHost(sub.id, jiraHost);
	}));

	const transformedSubscriptions = matchedSubscriptions.map((sub) => {
		const { repoOwner, repoUrl } = sub;
		return {
			id: transformRepositoryId(sub.gitHubInstallationId), // TODO - update this and write a test that includes server ids
			name: repoOwner,
			url: omitRepoNameFromUrl(repoUrl),
			avatarUrl: "" // TODO - update DB to support new field
		};
	});

	return transformedSubscriptions;
};

export const JiraSecurityWorkspacesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for POST workspaces");

	const { ids: subscriptionIds } = req.body;
	const { jiraHost } = res.locals;

	if (!subscriptionIds) {
		const errMessage = Errors.MISSING_WORKSPACE_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscriptions = await Promise.all(subscriptionIds.map(async (id) => {
		return await Subscription.findOneForGitHubInstallationId(id, undefined);
	}));

	// TODO - fix this tomorrow
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const transformedSubscriptions = await transformSubscriptions(subscriptions, jiraHost);

	res.status(200).json({ success: true, workspaces: transformedSubscriptions });
};
