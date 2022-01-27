import transformDeployment from "../transforms/deployment";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import getJiraClient, { DeploymentsResult } from "../jira/client";
import { sqsQueues } from "../sqs/queues";
import { GitHubAPI } from "probot";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

export default async (context: CustomContext, jiraClient, _util, githubInstallationId: number): Promise<void> => {
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
	webhookId: string,
	webhookPayload: WebhookPayloadDeploymentStatus,
	webhookReceivedDate: Date,
	jiraHost: string,
	installationId: number,
	rootLogger: LoggerWithTarget) => {

	const logger = rootLogger.child({
		webhookId: webhookId,
		installationId,
		webhookReceived: webhookReceivedDate,
	});

	logger.info("processing deployment message!");

	const jiraPayload = await transformDeployment(github, webhookPayload, jiraHost, logger);

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
}
