import transformCommit from "../transforms/commit";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { GitHubAppClient } from "../github/client/github-app-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { CommitQueryNode, getCommitsQueryWithChangedFiles, getCommitsQueryWithoutChangedFiles }  from "../github/client/github-queries";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { JiraCommitData } from "src/interfaces/jira";

type CommitData = {
	edges: CommitQueryNode[],
	jiraPayload: JiraCommitData | undefined
}

const fetchCommits = async (gitHubClient: GitHubAppClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

export const getCommits = async (logger: LoggerWithTarget, github: GitHubAPI, gitHubClient: GitHubAppClient, jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number): Promise<CommitData> => {
	logger.info("Syncing commits: started");
	if (await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BACKFILL, false, jiraHost)) {
		const { edges, commits }  = await fetchCommits(gitHubClient, repository, cursor, perPage);
		const jiraPayload = await transformCommit({ commits, repository });
		logger.info("Syncing commits: finished");

		return {
			edges,
			jiraPayload
		};
	}
	return await getCommitsOctoKit(logger, github, gitHubClient, jiraHost, repository, cursor, perPage);
};

// TODO: better typings
const getCommitsOctoKit = async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubAppClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number): Promise<CommitData> => {
	logger.info("Syncing commits: started");

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let commitsData: any = {};

	const fetchCommits = async (includeChangedFiles: boolean) => {
		return github.graphql(includeChangedFiles ? getCommitsQueryWithChangedFiles() : getCommitsQueryWithoutChangedFiles(), {
			owner: repository.owner.login,
			repo: repository.name,
			per_page: perPage,
			cursor
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
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	logger.info("Syncing commits: finished");

	return {
		edges,
		jiraPayload: transformCommit({ commits, repository })
	};
};