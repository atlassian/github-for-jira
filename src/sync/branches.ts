import { transformBranches } from "./transforms/branch";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { Repository as OctokitRepository} from "@octokit/graphql-schema";
import GitHubClient from "../github/client/github-client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GetBranchesQuery } from "../github/client/github-queries";

// TODO: better typings
export default async (logger: LoggerWithTarget, github: GitHubAPI, newGithub: GitHubClient, jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	logger.info("Syncing branches: started");

	const useNewGHClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCHES, false, jiraHost);
	const useNewGHPrUrl = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT, false, jiraHost);

	let result;
	if(useNewGHClient) {
		result = await newGithub.getBranchesPage(repository.owner.login, repository.name, perPage, cursor as string)
	} else {
		result = ((await github.graphql(GetBranchesQuery, {
			owner: repository.owner.login,
			repo: repository.name,
			per_page: perPage,
			cursor
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		})) as { repository: OctokitRepository});

	}

	const edges = result?.repository?.refs?.edges || [];

	const branches = edges.map(({ node: item }) => item);

	logger.info("Syncing branches: finished");

	const jiraPayload = await transformBranches({ branches, repository }, useNewGHPrUrl);

	return {
		edges,
		jiraPayload
	};
};
