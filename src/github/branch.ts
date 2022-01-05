import transformBranch from "../transforms/branch";
import issueKeyParser from "jira-issue-key-parser";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import _ from "lodash";
import {WebhookPayloadCreate, WebhookPayloadDelete} from "@octokit/webhooks";

export const createBranch = async (
	context: CustomContext,
	jiraClient
): Promise<void> => {

	const webhookPayload: WebhookPayloadCreate = context.payload;
	const jiraPayload = await transformBranch(context.github, webhookPayload);

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

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};

export const deleteBranch = async (context: CustomContext, jiraClient): Promise<void> => {
	const payload: WebhookPayloadDelete = context.payload;
	const issueKeys = issueKeyParser().parse(payload.ref);

	if (_.isEmpty(issueKeys)) {
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
		`${payload.repository?.id}`,
		payload.ref
	);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
