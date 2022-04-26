import { transformBranch } from "../transforms/transform-branch";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { isEmpty } from "lodash";
import { WebhookPayloadCreate, WebhookPayloadDelete } from "@octokit/webhooks";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { sqsQueues } from "../sqs/queues";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { getJiraClient } from "../jira/client/jira-client";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { getCloudInstallationId } from "./client/installation-id";
import { jiraIssueKeyParser } from "utils/jira-utils";

export const createBranchWebhookHandler = async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {

	const webhookPayload: WebhookPayloadCreate = context.payload;

	if (await booleanFlag(BooleanFlags.USE_SQS_FOR_BRANCH, false, jiraClient.baseURL)) {
		await sqsQueues.branch.sendMessage({
			jiraHost: jiraClient.baseURL,
			installationId: githubInstallationId,
			webhookReceived: Date.now(),
			webhookId: context.id,
			webhookPayload
		});
	} else {

		const gitHubClient = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), context.log);
		const jiraPayload = await transformBranch(gitHubClient, webhookPayload);

		if (!jiraPayload) {
			context.log("Halting further execution for createBranch since jiraPayload is empty");
			return;
		}

		context.log(`Sending jira update for create branch event for hostname: ${jiraClient.baseURL}`);

		const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);
		const { webhookReceived, name, log } = context;

		webhookReceived && emitWebhookProcessedMetrics(
			webhookReceived,
			name,
			log,
			jiraResponse?.status
		);
	}
};

export const processBranch = async (
	github: GitHubInstallationClient,
	webhookId: string,
	webhookPayload: WebhookPayloadCreate,
	webhookReceivedDate: Date,
	jiraHost: string,
	installationId: number,
	rootLogger: LoggerWithTarget
) => {
	const logger = rootLogger.child({
		webhookId: webhookId,
		installationId,
		webhookReceived: webhookReceivedDate
	});

	const jiraPayload = await transformBranch(github, webhookPayload);

	if (!jiraPayload) {
		logger.info("Halting further execution for createBranch since jiraPayload is empty");
		return;
	}

	logger.info(`Sending jira update for create branch event`);

	const jiraClient = await getJiraClient(
		jiraHost,
		installationId,
		logger
	);

	const jiraResponse = await jiraClient.devinfo.repository.update(jiraPayload);

	emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"create",
		logger,
		jiraResponse?.status
	);
};

export const deleteBranchWebhookHandler = async (context: CustomContext, jiraClient): Promise<void> => {
	const payload: WebhookPayloadDelete = context.payload;
	const issueKeys = jiraIssueKeyParser(payload.ref);

	if (isEmpty(issueKeys)) {
		context.log({ noop: "no_issue_keys" }, "Halting further execution for deleteBranch since issueKeys is empty");
		return;
	}

	context.log(`Deleting branch for repo ${context.payload.repository?.id} with ref ${context.payload.ref}`);

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
