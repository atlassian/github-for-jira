import { transformCommit } from "../transforms/transform-commit";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitBulkSubmitData } from "src/interfaces/jira";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { TaskResultPayload } from "~/src/sync/sync.types";
import { createHashWithSharedSecret } from "utils/encryption";
import { shouldSendAll } from "config/feature-flags";

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
	parentLogger: Logger,
	gitHubClient: GitHubInstallationClient,
	_jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload): Promise<TaskResultPayload<CommitQueryNode, JiraCommitBulkSubmitData>> => {

	const logger = parentLogger.child({ backfillTask: "Commit" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const commitSince = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, cursor, perPage);

	if (commits.length > 0) {
		const authoredDate = commits[commits.length - 1]?.authoredDate;
		logger.info(`Last commit authoredDate=${authoredDate?.toString() || "undefined"}`);
		(logger.fields || {}).commitShaArray = commits.map(c => createHashWithSharedSecret(String(c.oid)));
	}
	const alwaysSend = await shouldSendAll("commits-backfill", _jiraHost, logger);
	const jiraPayload = transformCommit(
		{ commits, repository },
		alwaysSend,
		messagePayload.gitHubAppConfig?.gitHubBaseUrl
	);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.commits?.length }, "Backfill task complete");

	return {
		edges,
		jiraPayload
	};
};
