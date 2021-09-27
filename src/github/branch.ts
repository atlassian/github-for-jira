import transformBranch from "../transforms/branch";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../jira/util/isEmpty";
import { calculateProcessingTimeInSeconds } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";

export const createBranch = async (
	context: CustomContext,
	jiraClient
): Promise<void> => {
	const jiraPayload = await transformBranch(context);

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_create_branch" },
			"Halting further execution for createBranch since jiraPayload is empty"
		);
		return;
	}

	context.log(
		`Sending jira update for create branch event for hostname: ${jiraClient.baseURL}`
	);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
	const { webhookReceived, name, log } = context;

	if (
		(await booleanFlag(BooleanFlags.WEBHOOK_RECEIVED_METRICS, false)) &&
		webhookReceived
	) {
		calculateProcessingTimeInSeconds(
			webhookReceived,
			name,
			log,
			jiraResponse?.status
		);
	}
};

export const deleteBranch = async (context, jiraClient): Promise<void> => {
	const issueKeys = issueKeyParser().parse(context.payload.ref);

	if (isEmpty(issueKeys)) {
		context.log(
			{ noop: "no_issue_keys" },
			"Halting further execution for deleteBranch since issueKeys is empty"
		);
		return undefined;
	}

	context.log(
		`Deleting branch for repo ${context.payload.repository?.id} with ref ${context.payload.ref}`
	);

	const jiraResponse = await jiraClient.devinfo.branch.delete(
		context.payload.repository?.id,
		context.payload.ref
	);
	const { webhookReceived, name, log } = context;

	if (
		(await booleanFlag(BooleanFlags.WEBHOOK_RECEIVED_METRICS, false)) &&
		webhookReceived
	) {
		calculateProcessingTimeInSeconds(
			webhookReceived,
			name,
			log,
			jiraResponse?.status
		);
	}
};
