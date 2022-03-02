import transformCommit from "../transforms/commit";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { getCommitsQuery, getCommitsResponse, getDefaultRefQuery, getDefaultRefResponse } from "../github/client/github-queries";
// import { booleanFlag, BooleanFlags } from "../config/feature-flags";

type RepositoryDetails = {
	owner: string,
	repoName: string,
	refName: string
}

export const getDefaultRef = async (useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, owner: string, repoName: string) => {
	let data: getDefaultRefResponse;
	if(useNewGitHubClient) {
		data = await gitHubClient.getDefaultRef(owner, repoName);
	} else {
		data = (await github.graphql(getDefaultRefQuery, {
			owner,
			repo: repoName
		}) as getDefaultRefResponse);
	}
	return (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";
};

const getCommitsRequest = async (useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, includeChangedFiles: boolean, cursor?: string | number, perPage?: number): Promise<getCommitsResponse> => {

	if(useNewGitHubClient) {
		return await gitHubClient.getCommitsPage(true, repoDetails.owner, repoDetails.repoName, repoDetails.refName, perPage, cursor);
	}
	return (await github.graphql(getCommitsQuery(includeChangedFiles), {
		owner: repoDetails.owner,
		repo: repoDetails.repoName,
		default_ref: repoDetails.refName,
		per_page: perPage,
		cursor,
	}) as any);
};

// According to the logs, GraphQL queries sometimes fail because the "changedFiles" field is not available.
// In this case we just try again, but without asking for the changedFiles field.
const retryFetchCommits = async (logger: LoggerWithTarget, err, useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, cursor?: string | number, perPage?: number) => {
	const changedFilesErrors = err.errors?.filter(e => e.message?.includes("The changedFiles count for this commit is unavailable"));

	if (changedFilesErrors?.length) {
		logger.info("retrying without changedFiles");
		return await getCommitsRequest(useNewGitHubClient, github, gitHubClient, repoDetails, false, cursor, perPage);
	}
	throw new Error(err);
};

const fetchCommits = async (logger: LoggerWithTarget, useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, cursor?: string | number, perPage?: number): Promise<any> => {
	let commitsData: getCommitsResponse;

	try {
		commitsData = await getCommitsRequest(useNewGitHubClient, github, gitHubClient, repoDetails, true, cursor, perPage);
	} catch (err) {
		commitsData = await retryFetchCommits(logger, err, useNewGitHubClient, github, gitHubClient, repoDetails, cursor, perPage);
	}
	// if the repository is empty, commitsData.repository.ref is null
	const edges = commitsData.repository?.ref?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

const createRepositoryDetailsObject = (owner: string, repoName: string, refName: string): RepositoryDetails => {
	return {
		owner,
		repoName,
		refName
	};
};

// named export todo
export const getCommits = async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
	logger.info("Syncing commits: started");
	const useNewGitHubClient = true;//await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BACKFILL, false, jiraHost);
	const refName = await getDefaultRef(useNewGitHubClient, github, _newGithub, repository.owner.login, repository.name);
	const repoDetails = createRepositoryDetailsObject(repository.owner.login, repository.name, refName);
	const { edges, commits }  = await fetchCommits(logger, useNewGitHubClient, github, _newGithub, repoDetails, cursor, perPage);
	const jiraPayload = await transformCommit({ commits, repository });
	logger.info("Syncing commits: finished");
	return {
		edges,
		jiraPayload
	};
};