import transformBranches from "./transforms/branch";
import { getBranches as getBranchesQuery } from "./queries";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import GitHubClient from "../github/client/github-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

// TODO: better typings
export default async (logger: LoggerWithTarget, github: GitHubAPI, _newGithub: GitHubClient, _jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	logger.info("Syncing branches: started");
	const { edges } = ((await github.graphql(getBranchesQuery, {
		owner: repository.owner.login,
		repo: repository.name,
		per_page: perPage,
		cursor
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as any).repository.refs;

	const branches = edges.map(({ node: item }) => item);

	logger.info("Syncing branches: finished");

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};
