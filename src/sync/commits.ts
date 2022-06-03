import { transformCommit } from "../transforms/transform-commit";
import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitData } from "src/interfaces/jira";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { TaskPayload } from "~/src/sync/installation";

const fetchCommits = async (gitHubClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

export const getCommitTask = async (
	logger: LoggerWithTarget,
	_github: GitHubAPI,
	gitHubClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor?: string | number,
	perPage?: number): Promise<TaskPayload<CommitQueryNode, JiraCommitData>> => {

	logger.debug("Syncing commits: started");
	const { edges, commits } = await fetchCommits(gitHubClient, repository, cursor, perPage);
	const jiraPayload = await transformCommit({ commits, repository });
	logger.debug("Syncing commits: finished");

	const timeCutoff = Date.now() - await numberFlag(NumberFlags.SYNC_MAIN_COMMIT_TIME_LIMIT, Date.now(), jiraHost);
	let isDone = false;
	if(edges?.length) {
		const lastCommit = edges[edges.length - 1];
		isDone = lastCommit.node.authoredDate.getTime() < timeCutoff;
	}

	return {
		edges,
		jiraPayload,
		isDone
	};
};
