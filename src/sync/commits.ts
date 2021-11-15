import transformCommit from "../transforms/commit";
import { getCommits as getCommitsQuery, getDefaultRef } from "./queries";
import { GitHubAPI } from "probot";
import { getLogger } from "../config/logger";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";

const logger = getLogger("sync.commits");

// TODO: better typings
export default async (github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {
	// TODO: fix typings for graphql
	const data = (await github.graphql(getDefaultRef, {
		owner: repository.owner.login,
		repo: repository.name
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any);

	const refName = (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let commitsData: any = {};

	const getCommits = async (includeChangedFiles: boolean) => {
		return github.graphql(getCommitsQuery(includeChangedFiles), {
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
		commitsData = await getCommits(true);
	} catch (err) {

		// According to the logs, GraphQL queries sometimes fail because the "changedFiles" field is not available.
		// In this case we just try again, but without asking for the changedFiles field.

		logger.info("retrying without changedFiles");

		const changedFilesErrors = err.errors?.filter(e => e.message?.includes("The changedFiles count for this commit is unavailable"));
		if (changedFilesErrors.length) {
			commitsData = await getCommits(false);
		}

		logger.info("successfully retried without changedFiles");
	}

	// if the repository is empty, commitsData.repository.ref is null
	const edges = commitsData.repository?.ref?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		jiraPayload: transformCommit({ commits, repository })
	};
};
