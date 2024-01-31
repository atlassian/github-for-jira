import { createHashWithSharedSecret } from "utils/encryption";
import Logger from "bunyan";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const extraLoggerInfo = (payload: any, logger: Logger): Record<string, string> => {

	const commitSha = payload?.after || payload?.commit_oid;

	const issueNumber = payload?.issue?.number;
	const issueCommentId = payload?.comment?.id;

	const prNumber = payload?.pull_request?.number;
	const prCommitSha = payload?.pull_request?.head?.sha;

	const refType = payload?.ref_type;
	const refName = payload?.ref;

	const workflowRunId = payload?.workflow_run?.id;

	const deploymentSha = payload?.deployment?.sha;
	const deploymentJobUrl = payload?.deployment_status?.target_url;

	//This is handled in WebhookMiddleware already
	//const repoName = ....

	const raw = {
		...(commitSha ? { commitSha } : undefined),
		...(issueNumber ? { issueNumber } : undefined),
		...(issueCommentId ? { issueCommentId } : undefined),
		...(prNumber ? { prNumber } : undefined),
		...(prCommitSha ? { prCommitSha } : undefined),
		...(refType ? { refType } : undefined),
		...(refName ? { refName } : undefined),
		...(workflowRunId ? { workflowRunId } : undefined),
		...(deploymentSha ? { deploymentSha } : undefined),
		...(deploymentJobUrl ? { deploymentJobUrl } : undefined)
	};

	try {
		const ret: Record<string, string> = {};
		for (const key of Object.keys(raw)) {
			ret[key] = createHashWithSharedSecret(raw[key] ? String(raw[key]) : undefined);
		}
		return ret;
	} catch (e: unknown) {
		logger.error({ err: e }, "Error getting hash from webhook value");
		return {};
	}

};



