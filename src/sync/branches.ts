import transformBranches from "./transforms/branch";
import { getBranches as getBranchesQuery } from "./queries";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";

// TODO: better typings
export default async (github: GitHubAPI, repository: Repository, cursor?: string) => {
	// TODO: fix typings for graphql
	const { edges } = ((await github.graphql(getBranchesQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		cursor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any).repository.refs;

	const branches = edges.map(({ node: item }) => item);

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};
