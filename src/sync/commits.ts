import { transformCommit } from "../transforms/transform-commit";
import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitData } from "src/interfaces/jira";
import { NumberFlags } from "config/feature-flags";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { getCommitSinceDate } from "~/src/sync/sync-utils";
import { TaskPayload } from "~/src/sync/sync.types";

const fetchCommits = async (gitHubClient: GitHubInstallationClient, repository: Repository, commitSince?: Date, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, commitSince, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

export const getCommitTask = async (
	logger: Logger,
	_github: GitHubAPI,
	gitHubClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor?: string | number,
	perPage?: number,
	messagePayload?: BackfillMessagePayload): Promise<TaskPayload<CommitQueryNode, JiraCommitData>> => {

	const commitSince = await getCommitSinceDate(jiraHost, NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, messagePayload?.commitsFromDate);
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, cursor, perPage);
	const jiraPayload = await transformCommit({ commits, repository });
	logger.info("Syncing commits: finished");

	return {
		edges,
		jiraPayload
	};
};
