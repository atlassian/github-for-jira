import { transformCommit } from "../transforms/transform-commit";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitBulkSubmitData } from "src/interfaces/jira";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { TaskResultPayload } from "~/src/sync/sync.types";
import { numberFlag, NumberFlags } from "config/feature-flags";

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
	jiraHost: string,
	repository: Repository,
	cursor: string | number | undefined,
	perPage: number,
	messagePayload?: BackfillMessagePayload): Promise<TaskResultPayload<CommitQueryNode, JiraCommitBulkSubmitData>> => {

	const accelerateBackfillSpeedCoef = await numberFlag(NumberFlags.ACCELERATE_BACKFILL_COEF, 0, jiraHost);

	const commitSince = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, cursor, Math.min(
		perPage * (accelerateBackfillSpeedCoef ? accelerateBackfillSpeedCoef : 1), 100
	));

	if (commits.length > 0) {
		logger.info(`Last commit authoredDate=${commits[commits.length - 1].authoredDate}`);
	}

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
