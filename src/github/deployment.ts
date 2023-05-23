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
import { cacheSuccessfulDeploymentInfo } from "services/deployment-cache-service";
import { Subscription } from "models/subscription";
import { statsd } from "config/statsd";
import { metricDeploymentCache } from "config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const deploymentWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	if (context.payload.deployment_status.state === "success") {
		if (await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK, subscription.jiraHost)) {
			await tryCacheSuccessfulDeploymentInfo(
				subscription.jiraHost,
				context.gitHubAppConfig.gitHubBaseUrl,
				context.gitHubAppConfig.gitHubAppId,
				context.payload,
				context.log
			);
		}
	}

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

	const { state, environment } = webhookPayload.deployment_status;

	logger.info({
		deploymentState: state,
		deploymentEnvironment: environment
	},"processing deployment message!");

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

const tryCacheSuccessfulDeploymentInfo = async (
	jiraHost: string,
	gitHubBaseUrl: string,
	gitHubAppId: number | undefined,
	webhookPayload: WebhookPayloadDeploymentStatus,
	logger: Logger
) => {

	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
	const tags = { gitHubProduct };
	const info = { jiraHost };

	try {
		statsd.increment(metricDeploymentCache.toCreate, tags, info);
		await cacheSuccessfulDeploymentInfo({
			gitHubBaseUrl,
			repositoryId: webhookPayload.repository.id,
			commitSha: webhookPayload.deployment.sha,
			env: webhookPayload.deployment_status.environment,
			createdAt: new Date(webhookPayload.deployment_status.created_at)
		}, logger);
		statsd.increment(metricDeploymentCache.created, tags, info);
		logger.info("Saved deployment information to dynamodb");
	} catch (e) {
		statsd.increment(metricDeploymentCache.failed, { failType: "persist", ...tags }, info);
		logger.error({ err: e }, "Error saving deployment information to dynamodb");
	}
};
