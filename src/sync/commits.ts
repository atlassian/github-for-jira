import transformCommit from "../transforms/commit";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { getCommitsQueryOctoKit, getDefaultRef }  from "../github/client/github-queries";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

const fetchCommits = async (gitHubClient: GitHubClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

export const getCommits = async (logger: LoggerWithTarget, github: GitHubAPI, gitHubClient: GitHubClient, jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
	logger.info("Syncing commits: started");
	if (await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BACKFILL, false, jiraHost)) {
		console.log("IM GETTING FROM GHCLIENT");
		const { edges, commits }  = await fetchCommits(gitHubClient, repository, cursor, perPage);
		const jiraPayload = await transformCommit({ commits, repository });
		logger.info("Syncing commits: finished");

		return {
			edges,
			jiraPayload
		};
	}
	console.log("IM GETTING FROM OCTO");
	return getCommitsOctoKit(logger, github, gitHubClient, jiraHost, repository, cursor, perPage) 
};

/*
* OCTOKIT implementation, to be removed with Feature flag clean up
*/

// TODO: better typings
const getCommitsOctoKit = async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
	logger.info("Syncing commits: started");

	// TODO: fix typings for graphql
	const data = (await github.graphql(getDefaultRef, {
		owner: repository.owner.login,
		repo: repository.name
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any);

	const refName = (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let commitsData: any = {};

	const fetchCommits = async (includeChangedFiles: boolean) => {
		return github.graphql(getCommitsQueryOctoKit(includeChangedFiles), {
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
		commitsData = await fetchCommits(true);
	} catch (err) {

		// According to the logs, GraphQL queries sometimes fail because the "changedFiles" field is not available.
		// In this case we just try again, but without asking for the changedFiles field.

		logger.info("retrying without changedFiles");

		const changedFilesErrors = err.errors?.filter(e => e.message?.includes("The changedFiles count for this commit is unavailable"));
		if (changedFilesErrors.length) {
			commitsData = await fetchCommits(false);
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