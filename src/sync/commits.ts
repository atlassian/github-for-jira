import { transformCommit } from "../transforms/transform-commit";
import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { CommitQueryNode } from "../github/client/github-queries";
import { JiraCommitData } from "src/interfaces/jira";

type CommitData = {
	edges: CommitQueryNode[],
	jiraPayload: JiraCommitData | undefined
}

const fetchCommits = async (gitHubClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const commitsData = await gitHubClient.getCommitsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = commitsData.repository?.defaultBranchRef?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		commits
	};
};

export const getCommitTask = async (logger: LoggerWithTarget, _github: GitHubAPI, gitHubClient: GitHubInstallationClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number): Promise<CommitData> => {
	logger.info("Syncing commits: started");
	const { edges, commits } = await fetchCommits(gitHubClient, repository, cursor, perPage);
	const jiraPayload = await transformCommit({ commits, repository });
	logger.info("Syncing commits: finished");

	return {
		edges,
		jiraPayload
	};
};
