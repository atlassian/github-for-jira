import transformCommit from "../transforms/commit";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import {getCommitsQuery, getDefaultRefQuery} from "../github/client/github-queries";

// TODO: better typings
export default async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
	logger.info("Syncing commits: started");

	// TODO: fix typings for graphql
	const data = (await github.graphql(getDefaultRefQuery, {
		owner: repository.owner.login,
		repo: repository.name
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any);

	const refName = (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let commitsData: any = {};

	const getCommits = async (includeChangedFiles: boolean) => {
		console.log("GET SOME COMMITS!!!! RARGGHHHHH");
		console.log("GET SOME COMMITS!!!! RARGGHHcursoeHHH");
		console.log(cursor);
		return github.graphql(getCommitsQuery(includeChangedFiles), {
			owner: repository.owner.login,
			repo: repository.name,
			per_page: perPage,
			cursor,
			default_ref: refName
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		});
	};

	// TODO: fix typings for graphql
	try {
		commitsData = await getCommits(true);
	} catch (err) {

		// According to the logs, GraphQL queries sometimes fail because the "changedFiles" field is not available.
		// In this case we just try again, but without asking for the changedFiles field.

		logger.info("retrying without changedFiles");

		const changedFilesErrors = err.errors?.filter(e => e.message?.includes("The changedFiles count for this commit is unavailable"));
		if (changedFilesErrors.length) {
			commitsData = await getCommits(false);
		}

		logger.info("successfully retried without changedFiles");
	}

	// if the repository is empty, commitsData.repository.ref is null
	const edges = commitsData.repository?.ref?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	logger.info("Syncing commits: finished");

	return {
		edges,
		jiraPayload: transformCommit({ commits, repository })
	};
};


// import transformCommit from "../transforms/commit";
// import { GitHubAPI } from "probot";
// import { Repository } from "../models/subscription";
// import GitHubClient from "../github/client/github-client";
// import { LoggerWithTarget } from "probot/lib/wrap-logger";
// import { getCommitsQuery, getCommitsResponse, getDefaultRefQuery, getDefaultRefResponse } from "../github/client/github-queries";
// import { booleanFlag, BooleanFlags } from "../config/feature-flags";

// type RepositoryDetails = {
// 	owner: string,
// 	repoName: string,
// 	refName: string
// }

// const getDefaultRef = async (useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, owner: string, repoName: string) => {
// 	let data: getDefaultRefResponse;
// 	if(useNewGitHubClient) {
// 		data = await gitHubClient.getDefaultRef(owner, repoName);
// 	} else {
// 		console.log("=========== MAKE FIRST GRAPHQL CALL");
// 		data = (await github.graphql(getDefaultRefQuery, {
// 			owner,
// 			repo: repoName
// 		}) as getDefaultRefResponse);
// 	}
// 	return (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";
// };

// const getCommitsRequest = async (useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, includeChangedFiles: boolean, cursor?: string | number, perPage?: number): Promise<getCommitsResponse> => {

// 	if(useNewGitHubClient) {
// 		return await gitHubClient.getCommitsPage(true, repoDetails.owner, repoDetails.repoName, repoDetails.refName, perPage, cursor);
// 	}
// 	console.log("=========== MAKE SECOND GRAPHQL CALL");
// 	console.log(repoDetails.owner);
// 	console.log(repoDetails.repoName);
// 	console.log(repoDetails.refName);
// 	console.log(perPage);
// 	console.log(cursor);
// 	return (github.graphql(getCommitsQuery(includeChangedFiles), {
// 		owner: repoDetails.owner,
// 		repo: repoDetails.repoName,
// 		default_ref: repoDetails.refName,
// 		per_page: perPage,
// 		cursor,
// 	}) as any);
// };

// // According to the logs, GraphQL queries sometimes fail because the "changedFiles" field is not available.
// // In this case we just try again, but without asking for the changedFiles field.
// // TODO _ TYPES
// const retryFetchCommits = async (logger: LoggerWithTarget, err, useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, cursor?: string | number, perPage?: number) => {
// 	const changedFilesErrors = err.errors?.filter(e => e.message?.includes("The changedFiles count for this commit is unavailable"));

// 	if (changedFilesErrors?.length) {
// 		logger.info("retrying without changedFiles");
// 		return await getCommitsRequest(useNewGitHubClient, github, gitHubClient, repoDetails, false, cursor, perPage);
// 	}
// 	console.log("=========== MADE AN EROR OH NO");
// 	console.log(err);
// 	// return;
// 	throw new Error(err);
// 	// return null;
// };

// const fetchCommits = async (logger: LoggerWithTarget, useNewGitHubClient: boolean, github: GitHubAPI, gitHubClient: GitHubClient, repoDetails: RepositoryDetails, cursor?: string | number, perPage?: number): Promise<any> => {
// 	let commitsData: getCommitsResponse;

// 	try {
// 		commitsData = await getCommitsRequest(useNewGitHubClient, github, gitHubClient, repoDetails, true, cursor, perPage);
// 	} catch (err) {
// 		console.log("=========== MADE AN EROR OH NO");
// 		console.log(err);
// 		commitsData = await retryFetchCommits(logger, err, useNewGitHubClient, github, gitHubClient, repoDetails, cursor, perPage);
// 	}
// 	// if the repository is empty, commitsData.repository.ref is null
// 	const edges = commitsData.repository?.ref?.target?.history?.edges;
// 	const commits = edges?.map(({ node: item }) => item) || [];

// 	return {
// 		edges,
// 		commits
// 	};
// };

// const createRepositoryDetailsObject = (owner: string, repoName: string, refName: string): RepositoryDetails => {
// 	return {
// 		owner,
// 		repoName,
// 		refName
// 	};
// };

// export const getCommits = async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
// 	logger.info("Syncing commits: started");
// 	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT, false, jiraHost);
// 	const refName = await getDefaultRef(useNewGitHubClient, github, _newGithub, repository.owner.login, repository.name);
// 	const repoDetails = createRepositoryDetailsObject(repository.owner.login, repository.name, refName);
// 	const { edges, commits }  = await fetchCommits(logger, useNewGitHubClient, github, _newGithub, repoDetails, cursor, perPage);
// 	const jiraPayload = transformCommit({ commits, repository });
// 	logger.info("Syncing commits: finished");

// 	console.log("=========== MADE AN EROR OH NO");
// 	return {
// 		edges,
// 		jiraPayload
// 	};
// };