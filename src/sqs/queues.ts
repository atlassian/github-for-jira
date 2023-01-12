import { envVars }  from "config/env";
import { SqsQueue } from "./sqs";
import { backfillQueueMessageHandler } from "./backfill";
import { pushQueueMessageHandler } from "./push";
import { jiraAndGitHubErrorsHandler, webhookMetricWrapper } from "./error-handlers";
import { deploymentQueueMessageHandler } from "./deployment";
import { branchQueueMessageHandler } from "./branch";
import { getLogger } from "config/logger";
import type { BackfillMessagePayload, PushQueueMessagePayload, DeploymentMessagePayload, BranchMessagePayload, WebhookMessagePayload } from "./sqs.types";
import { jiraWebhooksQueueMessageHandler } from "~/src/sqs/jira-webhooks-handler";
import { githubWebhooksQueueMessageHandler } from "~/src/sqs/github-webhooks-handler";

const LONG_POLLING_INTERVAL_SEC = 3;
const logger = getLogger("sqs-queues");

// TODO: Make this a class
export const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({
		queueName: "backfill",
		queueUrl: envVars.SQS_BACKFILL_QUEUE_URL,
		queueRegion: envVars.SQS_BACKFILL_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 10 * 60,
		maxAttempts: 3
	},
	backfillQueueMessageHandler,
	jiraAndGitHubErrorsHandler
	),

	push: new SqsQueue<PushQueueMessagePayload>({
		queueName: "push",
		queueUrl: envVars.SQS_PUSH_QUEUE_URL,
		queueRegion: envVars.SQS_PUSH_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	}, pushQueueMessageHandler, webhookMetricWrapper(jiraAndGitHubErrorsHandler, "push")),

	deployment: new SqsQueue<DeploymentMessagePayload>({
		queueName: "deployment",
		queueUrl: envVars.SQS_DEPLOYMENT_QUEUE_URL,
		queueRegion: envVars.SQS_DEPLOYMENT_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	},
	deploymentQueueMessageHandler,
	webhookMetricWrapper(jiraAndGitHubErrorsHandler, "deployment_status")
	),

	branch: new SqsQueue<BranchMessagePayload>({
		queueName: "branch",
		queueUrl: envVars.SQS_BRANCH_QUEUE_URL,
		queueRegion: envVars.SQS_BRANCH_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	},
	branchQueueMessageHandler,
	webhookMetricWrapper(jiraAndGitHubErrorsHandler, "create")
	),

	jira: new SqsQueue<WebhookMessagePayload>({
		queueName: "jira-webhooks",
		queueUrl: envVars.SQS_JIRA_WEBHOOKS_QUEUE_URL,
		queueRegion: envVars.SQS_JIRA_WEBHOOKS_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	},
	jiraWebhooksQueueMessageHandler,
	webhookMetricWrapper(jiraAndGitHubErrorsHandler, "jira")
	),

	github: new SqsQueue<WebhookMessagePayload>({
		queueName: "github-webhooks",
		queueUrl: envVars.SQS_GITHUB_WEBHOOKS_QUEUE_URL,
		queueRegion: envVars.SQS_GITHUB_WEBHOOKS_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	},
	githubWebhooksQueueMessageHandler,
	webhookMetricWrapper(jiraAndGitHubErrorsHandler, "github")
	),

	start: () => {
		logger.info("Starting queues");
		sqsQueues.backfill.start();
		sqsQueues.jira.start();
		sqsQueues.github.start();
		sqsQueues.push.start();
		sqsQueues.deployment.start();
		sqsQueues.branch.start();
		logger.info("All queues started");
	},

	stop: async () => {
		logger.info("Stopping queues");
		await Promise.all([
			sqsQueues.backfill.stop(),
			sqsQueues.jira.stop(),
			sqsQueues.github.stop(),
			sqsQueues.push.stop(),
			sqsQueues.deployment.stop(),
			sqsQueues.branch.stop()
		]);
		logger.info("All queues stopped");
	}
};
