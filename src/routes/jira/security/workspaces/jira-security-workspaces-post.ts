import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { RepoSyncState } from "models/reposyncstate";
import {
	getRepoUrlAndRepoId
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-post";

interface Workspace {
	id: string,
	name: string,
	url: string,
	avatarUrl: string
}

export const DEFAULT_AVATAR = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png;";

const omitRepoNameFromUrl = (url: string): string => {
	const segments = url.split("/");
	segments.pop();
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

export const splitServerId = (input: string): [string, string] => {
	const parts: string[] = input.split("-");
	return [parts[0], parts[1]];
};

const getSubscriptions = async (gitHubInstallationIds: string[]): Promise<Subscription[] | []> => {
	const results = await Promise.all(
		Array.from(new Set(gitHubInstallationIds)).map(async (id) => {
			const { repoUrl, id: gitHubInstallationId } = getRepoUrlAndRepoId(id);
			return await Subscription.findOneForGitHubInstallationIdAndRepoUrl(Number(gitHubInstallationId), repoUrl);
		})
	);

	// Loose check so we filter null and undefined values
	return results.filter((result) => result != null) as Subscription[];
};

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

	const subscriptions = await getSubscriptions(gitHubInstallationIds);
	const transformedSubscriptions = subscriptions.length ?
		await transformSubscriptions(subscriptions, jiraHost) : [];

	res.status(200).json({ success: true, workspaces: transformedSubscriptions });
};
