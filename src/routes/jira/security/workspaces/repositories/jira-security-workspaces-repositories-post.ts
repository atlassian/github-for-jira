import { Request, Response } from "express";
import { Errors } from "config/errors";
import { reverseCalculatePrefix, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { DEFAULT_AVATAR, splitServerId } from "routes/jira/security/workspaces/jira-security-workspaces-post";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { RepoSyncState } from "models/reposyncstate";

interface RepoUrlAndRepoId {
	repoUrl: string,
	id: string
}

export interface Container {
	id: string,
	name: string,
	url: string,
	avatarUrl: string,
	lastUpdatedDate: Date
}

export const getRepoUrlAndRepoId = (id: string): RepoUrlAndRepoId => {
	if (/-/.test(id)) {
		const [hashedRepoUrl, repoId] = splitServerId(id);
		const repoDomain = reverseCalculatePrefix(hashedRepoUrl);
		return { repoUrl: repoDomain, id: repoId };
	} else {
		return { repoUrl: GITHUB_CLOUD_BASEURL, id };
	}
};

const getRepos = async (repoIds: string[]): Promise<RepoSyncState[] | []> => {
	const results = await Promise.all(
		Array.from(new Set(repoIds)).map(async (id) => {
			// Account for server repoIds which will be passed in a format similar to "XXXXXXX-XXXX"
			const { repoUrl, id: repoId } = getRepoUrlAndRepoId(id);
			return await RepoSyncState.findOneForRepoUrlAndRepoId(repoUrl, repoId);
		})
	);

	// Loose check so we filter null and undefined values
	return results.filter((result) => result != null) as RepoSyncState[];
};

export const transformRepositories = async (
	repos: RepoSyncState[]
): Promise<Container[]> => {
	const transformedSubscriptions = repos.map((repo) => {
		const { repoId, repoName, repoUrl, updatedAt } = repo;
		const baseUrl = new URL(repoUrl).origin;
		return {
			id: transformRepositoryId(repoId, baseUrl),
			name: repoName,
			url: repoUrl,
			avatarUrl: DEFAULT_AVATAR,
			lastUpdatedDate: updatedAt
		};
	});

	return transformedSubscriptions;
};

export const JiraSecurityWorkspacesRepositoriesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to POST repositories");

	const { ids: repoIds } = req.body;

	if (!repoIds) {
		const errMessage = Errors.MISSING_CONTAINER_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await getRepos(repoIds);
	const transformedRepositories = repos.length ?
		await transformRepositories(repos) : [];

	res.status(200).json({
		success: true,
		containers: transformedRepositories
	});
};
