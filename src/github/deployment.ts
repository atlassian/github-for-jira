import { transformDeployment } from "../transforms/transform-deployment";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { getJiraClient, DeploymentsResult } from "../jira/client/jira-client";
import { sqsQueues } from "../sqs/queues";
import { GitHubAPI } from "probot";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { isBlocked } from "config/feature-flags";
import { GitHubInstallationClient } from "./client/github-installation-client";

export const deploymentWebhookHandler = async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {
	await sqsQueues.deployment.sendMessage({
		jiraHost: jiraClient.baseURL,
		installationId: githubInstallationId,
		webhookPayload: context.payload,
		webhookReceived: Date.now(),
		webhookId: context.id
	});
};

export const processDeployment = async (
	github: GitHubAPI,
	newGitHubClient: GitHubInstallationClient,
	webhookId: string,
	webhookPayload: WebhookPayloadDeploymentStatus,
	webhookReceivedDate: Date,
	jiraHost: string,
	installationId: number,
	rootLogger: LoggerWithTarget) => {

	const logger = rootLogger.child({
		webhookId: webhookId,
		installationId,
		webhookReceived: webhookReceivedDate
	});

	if (await isBlocked(installationId, logger)) {
		logger.warn("blocking processing of push message because installationId is on the blocklist");
		return;
	}

	logger.info("processing deployment message!");

	const jiraPayload = await transformDeployment(github, newGitHubClient, webhookPayload, jiraHost, logger);

	if (!jiraPayload) {
		logger.info(
			{ noop: "no_jira_payload_deployment" },
			"Halting further execution for deployment since jiraPayload is empty"
		);
		return;
	}

	const jiraClient = await getJiraClient(
		jiraHost,
		installationId,
		logger
	);

	const result: DeploymentsResult = await jiraClient.deployment.submit(jiraPayload);
	if (result.rejectedDeployments?.length) {
		logger.warn({
			jiraPayload,
			rejectedDeployments: result.rejectedDeployments
		}, "Jira API rejected deployment!");
	}

	emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"deployment_status",
		logger,
		result?.status
	);
};
