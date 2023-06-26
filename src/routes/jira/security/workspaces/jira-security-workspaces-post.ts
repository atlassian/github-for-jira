import { Request, Response } from "express";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

interface Workspace {
	id: string,
	name: string,
	url: string,
	avatarUrl: string
}

const getAllWorkspaces = async (
	subscriptionIds: number[]
): Promise<(Subscription | null)[]> => {
	const workspaces = await Promise.all(subscriptionIds.map(async (id) => {
		return await Subscription.findOneForGitHubInstallationId(id, undefined);
	}));

	return workspaces.filter(workspace => workspace !== null);
};

const transformSubscriptions = async (
	subscriptions: Subscription[]
): Promise<Workspace[]> => {

	const transformedSubscriptions = subscriptions.map((sub) => {
		return {
			id: transformRepositoryId(sub.gitHubInstallationId), // TODO - update this and write a test that includes server ids
			name: "", // TODO - get name from reposyncstate (owner),
			url: "", // TODO - get url from reposyncstate (repoUrl - trimmed)
			avatarUrl: "" // TODO - update DB to support new field
		};
	});

	return transformedSubscriptions;
};

export const JiraSecurityWorkspacesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for POST workspaces");

	const { ids: workspaceIds } = req.body;

	if (!workspaceIds) {
		const errMessage = Errors.MISSING_WORKSPACE_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const allMatchingSubscriptions = await getAllWorkspaces(workspaceIds);
	// TODO - fix this tomorrow
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const workspaces = await transformSubscriptions(allMatchingSubscriptions);

	res.status(200).json({ success: true, workspaces });
};
