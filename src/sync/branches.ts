import transformBranches from "./transforms/branch";
import { getBranches as getBranchesQuery } from "./queries";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

// TODO: better typings
export default async (github: GitHubAPI, newGithub: GitHubClient, jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	
	const useNewGHClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCHES, false, jiraHost);
	const client = useNewGHClient ? newGithub : github;
	const results = ((await client.graphql(getBranchesQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		per_page: perPage,
		cursor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any)

	const { edges } = results.repository.refs;
	const branches = edges.map(({ node: item }) => item);

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};
