import { transformBranches } from "./transforms/branch";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";

// TODO: better typings
export const getBranchTask = async (
	logger: Logger,
	gitHubClient: GitHubInstallationClient,
	_jiraHost: string,
	repository: Repository,
	cursor?: string | number,
	perPage?: number,
	messagePayload?: BackfillMessagePayload) => {
	// TODO: fix typings for graphql
	logger.debug("Syncing branches: started");
	perPage = perPage || 20;

	const result = await gitHubClient.getBranchesPage(repository.owner.login, repository.name, perPage, undefined, cursor as string);
	const edges = result?.repository?.refs?.edges || [];
	const branches = edges.map(edge => edge?.node);

	logger.debug("Syncing branches: finished");

	const jiraPayload = transformBranches({ branches, repository }, messagePayload?.gitHubAppConfig?.gitHubBaseUrl);

	return {
		edges,
		jiraPayload
	};
};
