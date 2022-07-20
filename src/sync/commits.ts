import { transformCommit } from "../transforms/transform-commit";
import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitData } from "src/interfaces/jira";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { TaskPayload } from "~/src/sync/installation";
import { BackfillMessagePayload } from "~/src/sqs/backfill";

const fetchCommits = async (gitHubClient: GitHubInstallationClient, repository: Repository, commitSince?: Date, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, commitSince, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

// export this so branches can re-use
export const getCommitSinceDate = async (jiraHost: string, commitFromDate?: Date): Promise<Date | undefined> => {
	if (commitFromDate) {
		return commitFromDate;
	}
	const timeCutoffMsecs = await numberFlag(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, NaN, jiraHost);
	if (!timeCutoffMsecs) {
		return;
	}
	return new Date(Date.now() - timeCutoffMsecs);
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

	const commitSince = await getCommitSinceDate(jiraHost, messagePayload?.commitsFromDate);
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, cursor, perPage);
	const jiraPayload = await transformCommit({ commits, repository });
	logger.info("Syncing commits: finished");

	return {
		edges,
		jiraPayload
	};
};
