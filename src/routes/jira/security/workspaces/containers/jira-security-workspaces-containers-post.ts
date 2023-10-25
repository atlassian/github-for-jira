import { Request, Response } from "express";
import { Errors } from "config/errors";
import { reverseCalculatePrefix, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { RepoSyncState } from "models/reposyncstate";
import { SecurityContainer } from "./jira-security-workspaces-containers.types";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

interface RepoUrlAndRepoId {
	repoUrl: string,
	id: number
}

export const DEFAULT_AVATAR = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

export const splitServerId = (input: string): [string, string] => {
	const parts: string[] = input.split("-");
	return [parts[0], parts[1]];
};

export const getRepoUrlAndRepoId = (id: string): RepoUrlAndRepoId => {
	if (/-/.test(id)) {
		const [hashedRepoUrl, repoId] = splitServerId(id);
		const repoDomain = reverseCalculatePrefix(hashedRepoUrl);
		return { repoUrl: repoDomain, id: parseInt(repoId) };
	} else {
		return { repoUrl: GITHUB_CLOUD_BASEURL, id: parseInt(id) };
	}
};

const getRepos = async (repoIds: string[], jiraHost: string): Promise<RepoSyncState[] | []> => {
	const results = await Promise.all(
		Array.from(new Set(repoIds)).map(async (id) => {
			// Account for server repoIds which will be passed in a format similar to "XXXXXXX-XXXX"
			const { repoUrl, id: repoId } = getRepoUrlAndRepoId(id);
			return await RepoSyncState.findOneForRepoUrlAndRepoIdAndJiraHost(repoUrl, repoId, jiraHost);
		})
	);

	// Loose check so we filter null and undefined values
	return results.filter((result) => result != null) as RepoSyncState[];
};

export const transformRepositories = async (
	repos: RepoSyncState[]
): Promise<SecurityContainer[]> => repos.map((repo) => {
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

export const JiraSecurityWorkspacesContainersPost = async (req: Request, res: Response): Promise<void> => {
	const { jiraHost } = res.locals;

	if (!await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost)) {
		res.status(403).send(Errors.FORBIDDEN_PATH);
		return;
	}

	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for security POST repositories");

	const { ids: repoIds } = req.body;

	if (!repoIds) {
		// TODO: Return fetchContainers error handling spec once implemented
		// https://hello.atlassian.net/wiki/spaces/CDX/pages/2639314030/RFC+Handle+fetchContainers+errors
		const errMessage = Errors.MISSING_SECURITY_CONTAINER_IDS;
		req.log.warn(errMessage);
		res.status(400).send(errMessage);
		return;
	}

	const repos = await getRepos(repoIds, jiraHost);
	const transformedRepositories = repos.length ?
		await transformRepositories(repos) : [];

	res.status(200).json({
		success: true,
		containers: transformedRepositories
	});
};
