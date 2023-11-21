import { transformBranch } from "../transforms/transform-branch";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { isEmpty } from "lodash";
import type { CreateEvent, DeleteEvent } from "@octokit/webhooks-types";
import { sqsQueues } from "../sqs/queues";
import Logger from "bunyan";
import { getJiraClient } from "../jira/client/jira-client";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraBranchBulkSubmitData } from "interfaces/jira";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { shouldSendAll } from "config/feature-flags";

export const createBranchWebhookHandler = async (context: WebhookContext<CreateEvent>, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {

	const webhookPayload = context.payload;
	// eslint-disable-next-line no-console
	console.log("webhookPayload bfr sqs queue ::+::",webhookPayload,"+",context?.action,"+", context.name);
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
	webhookPayload: CreateEvent,
	webhookReceivedDate: Date,
	jiraHost: string,
	gitHubInstallationId: number,
	rootLogger: Logger,
	gitHubAppId: number | undefined
) => {
	// eslint-disable-next-line no-console
	console.log("INSIDE processBranch :::+++:::",JSON.stringify(webhookPayload),JSON.stringify(webhookReceivedDate));
	// eslint-disable-next-line no-console
	console.log("processBranch :::+++:::",JSON.stringify(webhookPayload));
	const logger = rootLogger.child({
		webhookId: webhookId,
		gitHubInstallationId,
		jiraHost,
		webhookReceived: webhookReceivedDate
	});

	const alwaysSend = await shouldSendAll("branches", jiraHost, logger);
	const jiraPayload: JiraBranchBulkSubmitData | undefined = await transformBranch(github, webhookPayload, alwaysSend, logger);

	if (!jiraPayload) {
		logger.info("Halting further execution for createBranch since jiraPayload is empty");
		return;
	}
	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationId,
		gitHubAppId,
		logger
	);

	if (!jiraClient) {
		logger.info("Halting further execution for createBranch as JiraClient is empty for this installation");
		return;
	}

	logger.info(`Sending jira update for create branch event`);


	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);

	emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"create",
		jiraHost,
		logger,
		jiraResponse?.status,
		gitHubAppId
	);
};

export const deleteBranchWebhookHandler = async (context: WebhookContext<DeleteEvent>, jiraClient): Promise<void> => {
	const payload = context.payload;
	const issueKeys = jiraIssueKeyParser(payload.ref);

	if (isEmpty(issueKeys)) {
		context.log.info({ noop: "no_issue_keys" }, "Halting further execution for deleteBranch since issueKeys is empty");
		return;
	}

	context.log.info({ prRef: context.payload.ref }, `Deleting branch for repo ${context.payload.repository?.id}`);

	const jiraResponse = await jiraClient.devinfo.branch.delete(
		transformRepositoryId(payload.repository?.id, context.gitHubAppConfig?.gitHubBaseUrl),
		payload.ref
	);
	const { webhookReceived, name, log } = context;
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		jiraClient.baseURL,
		log,
		jiraResponse?.status,
		gitHubAppId
	);
};
