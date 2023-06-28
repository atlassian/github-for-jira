import { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";
import {
	getRepoUrlAndRepoId, transformRepositories
} from "routes/jira/security/workspaces/repositories/jira-security-workspaces-repositories-post";
import { RepoSyncStateAndSubscription } from "models/reposyncstate";
// import sanitizeHtml from "sanitize-html";
// import { RepoSyncState } from "models/reposyncstate";

// example query
// "https://my.security.provider.com/containers/search?workspaceId=12345&searchQuery=my-container-name"

// const DEFAULT_PAGE_NUMBER = 1; // Current page
export const DEFAULT_LIMIT = 100; // Number of items per page

// const getRepos = async (gitHubInstallationId: number, repoName: string): Promise<RepoSyncState[] | []> => {
// 	const results = await Promise.all(
// 		Array.from(new Set(repoIds)).map(async (id) => {
// 			// Account for server repoIds which will be passed in a format similar to "XXXXXXX-XXXX"
// 			const { repoUrl, repoId } = getRepoUrlAndRepoId(id);
// 			return await RepoSyncState.findOneForRepoUrlAndRepoId(repoUrl, repoId);
// 		})
// 	);
//
// 	// Loose check so we filter null and undefined values
// 	return results.filter((result) => result != null) as RepoSyncState[];
// };

const getRepos = async (gitHubInstallationId: string, repoName: string): Promise<RepoSyncStateAndSubscription[]> => {
	const { id } = getRepoUrlAndRepoId(gitHubInstallationId);
	const results = await Subscription.findAllForGitHubInstallationIdAndRepoName(Number(id), repoName);

	return results.filter((result) => result != null) as RepoSyncStateAndSubscription[];
};

export const JiraSecurityWorkspacesRepositoriesGet = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to GET repositories");

	const gitHubInstallationId = sanitizeHtml(req.query?.workspaceId as string);

	if (!gitHubInstallationId) {
		const errMessage = Errors.MISSING_WORKSPACE_ID;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repoName = sanitizeHtml(req.query?.searchQuery as string);

	if (!repoName) {
		const errMessage = Errors.MISSING_CONTAINER_NAME;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await getRepos(gitHubInstallationId, repoName);
	const transformedRepositories = repos.length ?
		await transformRepositories(repos) : [];

	res.status(200).json({
		success: true,
		containers: transformedRepositories
	});
};

// response payload
// {
// 	"containers"
// :
// 	[
// 		{
// 			// Identifier of the security container which will be used to hydrate container details. This should be in this regex format: [a-zA-Z0-9\\-_.~@:{}=]+(/[a-zA-Z0-9\\-_.~@:{}=]+)*.
// 			id: "f730ce9c-3442-4f8a-93a4-a44f3b35c46b/target/111-222-333",
// 			// Human readable name of the container
// 			name: "my-container-name",
// 			// Url allowing Jira to link directly to the provider's container
// 			url: "https://my.security.provider.com/f730ce9c-3442-4f8a-93a4-a44f3b35c46b/container/f730ce9c-3442-4f8a-93a4-a44f3b35c46b",
// 			// Url providing the avatar for the container.
// 			avatarUrl: "https://res.cloudinary.com/snyk/image/upload/v1584038122/groups/Atlassian_Logo.png",
// 			// The date and time this container was last scanned/updated
// 			lastUpdatedDate: "2022-01-19T23:27:25+00:00"
// 		}
// 	]
// }
