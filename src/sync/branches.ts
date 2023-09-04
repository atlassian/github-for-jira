import { transformBranches } from "./transforms/branch";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { createHashWithSharedSecret } from "utils/encryption";

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
	const result = await gitHubClient.getBranchesPage(repository.owner.login, repository.name, perPage, commitSince, cursor);
	const edges = result.repository.refs.edges || [];
	const branches = edges.map(edge => edge.node);
	(logger.fields || {}).branchNameArray = (branches || []).map(b => createHashWithSharedSecret(String(b.name)));
	(logger.fields || {}).branchShaArray = (branches || []).map(b => createHashWithSharedSecret(String(b.target.oid)));

	const jiraPayload = transformBranches({ branches, repository }, messagePayload.gitHubAppConfig?.gitHubBaseUrl);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.branches?.length }, "Backfill task complete");

	return {
		edges,
		jiraPayload
	};
};
