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

export const DEFAULT_AVATAR = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png;";

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
		const { repoOwner, repoUrl, avatarUrl } = sub;
		const baseUrl = new URL(repoUrl).origin;
		return {
			id: transformRepositoryId(sub.gitHubInstallationId, baseUrl),
			name: repoOwner,
			url: omitRepoNameFromUrl(repoUrl),
			avatarUrl: avatarUrl || DEFAULT_AVATAR
		};
	});

	return transformedSubscriptions;
};

// const extractIdForServer = (id: string): string | null => {
// 	const index = id.indexOf("-");
// 	if (index !== -1) {
// 		return id.substring(index + 1);
// 	} else {
// 		return id;
// 	}
// };

export const JiraSecurityWorkspacesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for POST workspaces");

	const { ids: gitHubInstallationIds } = req.body;
	const { jiraHost } = res.locals;

	if (!gitHubInstallationIds) {
		const errMessage = Errors.MISSING_WORKSPACE_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const subscriptions = await Promise.all(
		Array.from(new Set(gitHubInstallationIds)).map(async (id) => {
			const subscriptionId = id as number;
			// TODO - update this to cross check reposyncstate owner for server
			return await Subscription.findOneForGitHubInstallationId(subscriptionId, undefined);
		})
	);

	const transformedSubscriptions = await transformSubscriptions(
		subscriptions.filter((sub): sub is Subscription => sub !== null),
		jiraHost
	);

	res.status(200).json({ success: true, workspaces: transformedSubscriptions });
};
