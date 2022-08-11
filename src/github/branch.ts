import { transformBranch } from "../transforms/transform-branch";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { isEmpty } from "lodash";
import { WebhookPayloadCreate, WebhookPayloadDelete } from "@octokit/webhooks";
import { sqsQueues } from "../sqs/queues";
import Logger from "bunyan";
import { getJiraClient } from "../jira/client/jira-client";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraBranchData } from "../interfaces/jira";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { WebhookContext } from "../routes/github/webhook/webhook-context";

export const createBranchWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {

	const webhookPayload: WebhookPayloadCreate = context.payload;

	await sqsQueues.branch.sendMessage({
		jiraHost: jiraClient.baseURL,
		installationId: gitHubInstallationId,
		webhookReceived: Date.now(),
		webhookId: context.id,
		webhookPayload,
		gitHubAppConfig: context.gitHubAppConfig
	});
};

export const processBranch = async (
	github: GitHubInstallationClient,
	webhookId: string,
	webhookPayload: WebhookPayloadCreate,
	webhookReceivedDate: Date,
	jiraHost: string,
	gitHubInstallationId: number,
	rootLogger: Logger,
	gitHubAppId?: number
) => {
	const logger = rootLogger.child({
		webhookId: webhookId,
		gitHubInstallationId,
		jiraHost,
		webhookReceived: webhookReceivedDate
	});

	const jiraPayload: JiraBranchData | undefined = await transformBranch(github, webhookPayload);

	if (!jiraPayload) {
		logger.info("Halting further execution for createBranch since jiraPayload is empty");
		return;
	}

	logger.info(`Sending jira update for create branch event`);

	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationId,
	);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload, gitHubAppId);

	emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"create",
		logger,
		jiraResponse?.status
	);
};

export const deleteBranchWebhookHandler = async (context: WebhookContext, jiraClient): Promise<void> => {
	const payload: WebhookPayloadDelete = context.payload;
	const issueKeys = jiraIssueKeyParser(payload.ref);

	if (isEmpty(issueKeys)) {
		context.log.info({ noop: "no_issue_keys" }, "Halting further execution for deleteBranch since issueKeys is empty");
		return;
	}

	context.log.info(`Deleting branch for repo ${context.payload.repository?.id} with ref ${context.payload.ref}`);

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
