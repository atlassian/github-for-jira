import transformCommit from "../transforms/commit";
import { getCommits as getCommitsQuery, getDefaultRef } from "./queries";
import { GitHubAPI } from "probot";

// TODO: better typings
export default async (github: GitHubAPI, repository, cursor: string) => {
	// TODO: fix typings for graphql
	const data = (await github.graphql(getDefaultRef, {
		owner: repository.owner.login,
		repo: repository.name
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any);

	const refName = (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : "master";

	// TODO: fix typings for graphql
	const commitsData = (await github.graphql(getCommitsQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		cursor,
		default_ref: refName
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any;

	// if the repository is empty, commitsData.repository.ref is null
	const edges = commitsData.repository.ref?.target?.history?.edges;
	const commits = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		jiraPayload: transformCommit({ commits, repository })
	};
};
