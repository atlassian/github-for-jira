import { transformBranch } from "../transforms/transform-branch";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { isEmpty } from "lodash";
import { WebhookPayloadCreate, WebhookPayloadDelete } from "@octokit/webhooks";
import { sqsQueues } from "../sqs/queues";
import Logger from "bunyan";
import { getJiraClient } from "../jira/client/jira-client.old";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraBranchBulkSubmitData } from "interfaces/jira";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

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
	gitHubAppId: number | undefined
) => {
	const logger = rootLogger.child({
		webhookId: webhookId,
		gitHubInstallationId,
		jiraHost,
		webhookReceived: webhookReceivedDate
	});

	const jiraPayload: JiraBranchBulkSubmitData | undefined = await transformBranch(github, webhookPayload, logger);

	if (!jiraPayload) {
		logger.info("Halting further execution for createBranch since jiraPayload is empty");
		return;
	}

	logger.info(`Sending jira update for create branch event`);

	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationId,
		gitHubAppId,
		logger
	);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);

	emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"create",
		logger,
		jiraResponse?.status,
		gitHubAppId
	);
};

export const deleteBranchWebhookHandler = async (context: WebhookContext, jiraClient): Promise<void> => {
	const payload: WebhookPayloadDelete = context.payload;
	const issueKeys = jiraIssueKeyParser(payload.ref);

	if (isEmpty(issueKeys)) {
		context.log.info({ noop: "no_issue_keys" }, "Halting further execution for deleteBranch since issueKeys is empty");
		return;
	}

	context.log.info({ prRef: context.payload.ref }, `Deleting branch for repo ${context.payload.repository?.id}`);

	const jiraResponse = await jiraClient.devinfo.branch.delete(
		await transformRepositoryId(payload.repository?.id, context.gitHubAppConfig?.gitHubBaseUrl),
		payload.ref
	);
	const { webhookReceived, name, log } = context;
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status,
		gitHubAppId
	);
};
