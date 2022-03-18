import { transformBranches } from "./transforms/branch";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { GitHubAppClient } from "../github/client/github-app-client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

// TODO: better typings
export default async (logger: LoggerWithTarget, _github: GitHubAPI, newGithub: GitHubAppClient, jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	logger.info("Syncing branches: started");

	perPage = perPage || 20;
	const useNewGHClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_BRANCHES, false, jiraHost);

	let result;
	if (useNewGHClient) {
		result = await newGithub.getBranchesPage(repository.owner.login, repository.name, perPage, cursor as string);
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
	const branches = edges.map(edge => edge?.node);

	logger.info("Syncing branches: finished");

	const jiraPayload = await transformBranches({ branches, repository });

	return {
		edges,
		jiraPayload
	};
};
