import { transformDeployment } from "../transforms/transform-deployment";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { getJiraClient, DeploymentsResult } from "../jira/client/jira-client";
import { sqsQueues } from "../sqs/queues";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import Logger from "bunyan";
import { isBlocked } from "config/feature-flags";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraDeploymentBulkSubmitData } from "interfaces/jira";
import { WebhookContext } from "routes/github/webhook/webhook-context";

export const deploymentWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	await sqsQueues.deployment.sendMessage({
		jiraHost: jiraClient.baseURL,
		installationId: gitHubInstallationId,
		webhookPayload: context.payload,
		webhookReceived: Date.now(),
		webhookId: context.id,
		gitHubAppConfig: context.gitHubAppConfig
	});
};

export const processDeployment = async (
	newGitHubClient: GitHubInstallationClient,
	webhookId: string,
	webhookPayload: WebhookPayloadDeploymentStatus,
	webhookReceivedDate: Date,
	jiraHost: string,
	gitHubInstallationId: number,
	rootLogger: Logger,
	gitHubAppId: number | undefined,
	rateLimited?: boolean
) => {

	const logger = rootLogger.child({
		webhookId: webhookId,
		gitHubInstallationId,
		jiraHost,
		webhookReceived: webhookReceivedDate
	});

	if (await isBlocked(gitHubInstallationId, logger)) {
		logger.warn("blocking processing of push message because installationId is on the blocklist");
		return;
	}

	logger.info("processing deployment message!");

	const metrics = {
		trigger: "deployment_queue"
	};
	const jiraPayload: JiraDeploymentBulkSubmitData | undefined = await transformDeployment(newGitHubClient, webhookPayload, jiraHost, metrics, logger, gitHubAppId);

	logger.info("deployment message transformed");

	if (!jiraPayload) {
		logger.info(
			{ noop: "no_jira_payload_deployment" },
			"Halting further execution for deployment since jiraPayload is empty"
		);
		return;
	}

	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationId,
		gitHubAppId,
		logger
	);

	const result: DeploymentsResult = await jiraClient.deployment.submit(jiraPayload);
	if (result.rejectedDeployments?.length) {

		let extraDebugInfo = {};
		try {
			const deploymentData = jiraPayload.deployments.length > 0 ? jiraPayload.deployments[0] : undefined;
			extraDebugInfo = deploymentData ? {
				issueKeysCount: deploymentData.associations.filter(a => a.associationType === "issueKeys").map(a => a.values.length).reduce((a, b) => a + b, 0),
				issueIdOrKeysCount: deploymentData.associations.filter(a => a.associationType === "issueIdOrKeys").map(a => a.values.length).reduce((a, b) => a + b, 0),
				serviceIdOrKeysCount: deploymentData.associations.filter(a => a.associationType === "serviceIdOrKeys").map(a => a.values.length).reduce((a, b) => a + b, 0),
				commitCount: deploymentData.associations.filter(a => a.associationType === "commit").map(a => a.values.length).reduce((a, b) => a + b, 0)
			} : {};
		} catch (e) {
			logger.warn("Something wrong extracting debugging information for rejected deployments.");
		}

		logger.warn({
			rejectedDeployments: result.rejectedDeployments,
			...extraDebugInfo
		}, "Jira API rejected deployment!");
	}

	// TODO - remove the rate limited test once valid metrics have been decided
	!rateLimited && emitWebhookProcessedMetrics(
		webhookReceivedDate.getTime(),
		"deployment_status",
		jiraHost,
		logger,
		result?.status,
		gitHubAppId
	);
};
