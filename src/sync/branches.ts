import transformBranches from "./transforms/branch";
import { getBranches as getBranchesQuery } from "./queries";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";

// TODO: better typings
export default async (github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	const { edges } = ((await github.graphql(getBranchesQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		per_page: perPage,
		cursor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any).repository.refs;

	const branches = edges.map(({ node: item }) => item);

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};
