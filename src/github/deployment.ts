import transformDeployment from "../transforms/deployment";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import getJiraClient, { DeploymentsResult } from "../jira/client";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import sqsQueues from "../sqs/queues";
import { GitHubAPI } from "probot";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

export default async (context: CustomContext, jiraClient, githubInstallationId: number): Promise<void> => {

	if (await booleanFlag(BooleanFlags.USE_SQS_FOR_DEPLOYMENT, false, jiraClient.baseURL)) {
		await sqsQueues.deployment.sendMessage({
			jiraHost: jiraClient.baseURL,
			installationId: githubInstallationId,
			webhookPayload: context.payload,
			webhookReceived: new Date(),
			webhookId: context.id
		});
	} else {

		const jiraPayload = await transformDeployment(context.github, context.payload, jiraClient.baseURL, context.log);

		if (!jiraPayload) {
			context.log(
				{ noop: "no_jira_payload_deployment" },
				"Halting further execution for deployment since jiraPayload is empty"
			);
			return;
		}

		const result: DeploymentsResult = await jiraClient.deployment.submit(jiraPayload);
		if (result.rejectedDeployments?.length) {
			context.log.warn({
				jiraPayload,
				rejectedDeployments: result.rejectedDeployments
			}, "Jira API rejected deployment!");
		}

		const { webhookReceived, name, log } = context;

		webhookReceived && emitWebhookProcessedMetrics(
			webhookReceived,
			name,
			log,
			result?.status
		);
	}
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
