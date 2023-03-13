import { transformCommit } from "../transforms/transform-commit";
import { Repository, Subscription } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitBulkSubmitData } from "src/interfaces/jira";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { TaskPayload } from "~/src/sync/sync.types";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";

const fetchCommits = async (gitHubClient: GitHubInstallationClient, repository: Repository, commitSince?: Date, commitUntil?: Date, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, commitSince, commitUntil, cursor);
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
	cursor?: string | number,
	perPage?: number,
	messagePayload?: BackfillMessagePayload): Promise<TaskPayload<CommitQueryNode, JiraCommitBulkSubmitData>> => {

	const commitSince = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	let commitUntil: Date | undefined = undefined;
	const shouldUseBackfillAlgoIncremental = await booleanFlag(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, jiraHost);
	if (shouldUseBackfillAlgoIncremental) {
		commitUntil = await backfilledUntil(jiraHost, repository.id, messagePayload);
		// Commits already backfilled for given time
		if (commitSince && commitUntil && commitSince?.getTime() > commitUntil?.getTime()) {
			return {
				edges: []
			};
		}
	}
	const { edges, commits } = await fetchCommits(gitHubClient, repository, commitSince, commitUntil, cursor, perPage);
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


const backfilledUntil = async (jiraHost: string, repoId: number, messagePayload?: BackfillMessagePayload) => {
	if (messagePayload) {
		const subscription = await Subscription.getSingleInstallation(jiraHost, messagePayload.installationId, messagePayload.gitHubAppConfig?.gitHubAppId);
		if (subscription) {
			const syncState =	await RepoSyncState.findByRepoId(subscription, repoId);
			return syncState ? syncState?.commitFrom : undefined;
		}
	}
	return undefined;
};
