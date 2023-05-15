import { transformDeployment } from "../transforms/transform-deployment";
import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { getJiraClient, DeploymentsResult } from "../jira/client/jira-client";
import { sqsQueues } from "../sqs/queues";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import Logger from "bunyan";
import { isBlocked, booleanFlag, BooleanFlags } from "config/feature-flags";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { JiraDeploymentBulkSubmitData } from "interfaces/jira";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { saveDeploymentInfo } from "models/deployment-service";
import { statsd } from "config/statsd";
import { metricDeploymentPersistent } from "config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

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

	if (webhookPayload.deployment_status.state === "success") {
		if (await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK, jiraHost)) {
			await persistentSuccessDeploymentStatusToDynamoDB(jiraHost, newGitHubClient, gitHubAppId, webhookPayload, logger);
		}
	}

	const metrics = {
		trigger: "deployment_queue"
	};
	const jiraPayload: JiraDeploymentBulkSubmitData | undefined = await transformDeployment(newGitHubClient, webhookPayload, jiraHost, "webhook", metrics, logger, gitHubAppId);

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

	const result: DeploymentsResult = await jiraClient.deployment.submit(jiraPayload, webhookPayload.repository.id);

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

const persistentSuccessDeploymentStatusToDynamoDB = async (
	jiraHost: string,
	gitHubInstallationClient: GitHubInstallationClient,
	gitHubAppId: number | undefined,
	webhookPayload: WebhookPayloadDeploymentStatus,
	logger: Logger
) => {

	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
	const tags = { gitHubProduct };
	const info = { jiraHost };

	try {
		statsd.increment(metricDeploymentPersistent.toCreate, tags, info);
		await saveDeploymentInfo({
			gitHubBaseUrl: gitHubInstallationClient.baseUrl,
			gitHubInstallationId: gitHubInstallationClient.githubInstallationId.installationId,
			repositoryId: webhookPayload.repository.id,
			commitSha: webhookPayload.deployment.sha,
			description: webhookPayload.deployment.description || "",
			env: webhookPayload.deployment_status.environment,
			status: webhookPayload.deployment_status.state,
			createdAt: new Date(webhookPayload.deployment_status.created_at)
		}, logger);
		statsd.increment(metricDeploymentPersistent.created, tags, info);
		logger.info("Saved deployment information to dynamodb");
	} catch (e) {
		statsd.increment(metricDeploymentPersistent.failed, { failType: "persist", ...tags }, info);
		logger.error({ err: e }, "Error saving deployment information to dynamodb");
		throw e;
	}
};
