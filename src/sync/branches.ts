import { transformBranches } from "./transforms/branch";
import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { numberFlag, NumberFlags } from "config/feature-flags";

// TODO: better typings
export const getBranchTask = async (
	logger: LoggerWithTarget,
	_github: GitHubAPI,
	newGithub: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor?: string | number,
	perPage?: number) => {
	// TODO: fix typings for graphql
	logger.info("Syncing branches: started");
	perPage = perPage || 20;
	const timeCutoffMsecs = await numberFlag(NumberFlags.SYNC_BRANCH_COMMIT_TIME_LIMIT, NaN, jiraHost);
	const result = await newGithub.getBranchesPage(repository.owner.login, repository.name, perPage, timeCutoffMsecs, cursor as string);
	const edges = result?.repository?.refs?.edges || [];
	const branches = edges.map(edge => edge?.node);

	logger.info("Syncing branches: finished");

	const jiraPayload = await transformBranches({ branches, repository });

	return {
		edges,
		jiraPayload
	};
};
