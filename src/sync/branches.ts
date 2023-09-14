import { transformBranches } from "./transforms/branch";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { createHashWithSharedSecret } from "utils/encryption";
import { shouldSendAll } from "config/feature-flags";
import { Branch } from "~/src/github/client/github-client.types";

// TODO: better typings
export const getBranchTask = async (
	parentLogger: Logger,
	gitHubClient: GitHubInstallationClient,
	_jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload) => {

	const logger = parentLogger.child({ backfillTask: "Branch" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const commitSince = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const result = await gitHubClient.getBranchesPage(repository.owner.login, repository.name, perPage, commitSince, cursor as string);
	const edges = result?.repository?.refs?.edges || [];
	const branches: Branch[] = edges.map(edge => edge?.node);
	(logger.fields || {}).branchNameArray = (branches || []).map(b => createHashWithSharedSecret(String(b.name)));
	(logger.fields || {}).branchShaArray = (branches || []).map(b => createHashWithSharedSecret(String(b.target?.oid)));
	const alwaysSendBranches = await shouldSendAll("branches-backfill", _jiraHost, logger);
	const alwaysSendCommits = await shouldSendAll("commits-backfill", _jiraHost, logger);
	const jiraPayload = transformBranches({ branches, repository }, messagePayload.gitHubAppConfig?.gitHubBaseUrl, alwaysSendBranches, alwaysSendCommits);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.branches?.length }, "Backfill task complete");

	return {
		edges,
		jiraPayload
	};
};
