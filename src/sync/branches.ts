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
	const useNewGHPrUrl = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT, false, jiraHost);
	const result = await newGithub.getBranchesPage(repository.owner.login, repository.name, perPage, cursor as string);
	const edges = result?.repository?.refs?.edges || [];
	const branches = edges.map(edge => edge?.node);

	logger.info("Syncing branches: finished");

	const jiraPayload = await transformBranches({ branches, repository }, useNewGHPrUrl);

	return {
		edges,
		jiraPayload
	};
};
