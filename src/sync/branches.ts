import { transformBranches } from "./transforms/branch";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { GitHubAppClient } from "../github/client/github-app-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

// TODO: better typings
export default async (logger: LoggerWithTarget, _github: GitHubAPI, newGithub: GitHubAppClient, _jiraHost: string, repository:Repository, cursor?:string | number, perPage?:number) => {
	// TODO: fix typings for graphql
	logger.info("Syncing branches: started");
	perPage = perPage || 20;
	const result = await newGithub.getBranchesPage(repository.owner.login, repository.name, perPage, cursor as string);
	const edges = result?.repository?.refs?.edges || [];
	const branches = edges.map(edge => edge?.node);

	logger.info("Syncing branches: finished");

	const jiraPayload = await transformBranches({ branches, repository });

	return {
		edges,
		jiraPayload
	};
};