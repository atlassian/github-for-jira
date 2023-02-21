import { transformCommit } from "../transforms/transform-commit";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitBulkSubmitData } from "src/interfaces/jira";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { TaskPayload } from "~/src/sync/sync.types";
import { convertCommitsFromDateStringToDate } from "~/src/sync/sync-utils";

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
	gitHubClient: GitHubInstallationClient,
	_jiraHost: string,
	repository: Repository,
	cursor?: string | number,
	perPage?: number,
	messagePayload?: BackfillMessagePayload): Promise<TaskPayload<CommitQueryNode, JiraCommitBulkSubmitData>> => {

	const commitSince = convertCommitsFromDateStringToDate(messagePayload?.commitsFromDate, logger);
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, cursor, perPage);
	const jiraPayload = transformCommit(
		{ commits, repository },
		messagePayload?.gitHubAppConfig?.gitHubBaseUrl
	);
	logger.debug("Syncing commits: finished");

	return {
		edges,
		jiraPayload
	};
};
