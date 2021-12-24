import envVars from "../config/env";
import {ErrorHandlingResult, SqsQueue} from "./index";
import { BackfillMessagePayload, backfillQueueMessageHandler } from "./backfill";
import { pushQueueMessageHandler, PushQueueMessagePayload } from "./push";
import { jiraAndGitHubErrorsHandler, webhookMetricWrapper } from "./error-handlers";
import {DiscoveryMessagePayload, discoveryQueueMessageHandler} from "./discovery";
import { DeploymentMessagePayload, deploymentQueueMessageHandler } from "./deployment";
import { BranchMessagePayload, branchQueueMessageHandler } from "./branch";

const LONG_POLLING_INTERVAL_SEC = 3;

const sqsQueues = {
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

	discovery: new SqsQueue<DiscoveryMessagePayload>({
		queueName: "discovery",
		queueUrl: envVars.SQS_DISCOVERY_QUEUE_URL,
		queueRegion: envVars.SQS_DISCOVERY_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 10 * 60,
		maxAttempts: 3
	},
	discoveryQueueMessageHandler,
	jiraAndGitHubErrorsHandler
	),

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
	webhookMetricWrapper(jiraOctokitErrorHandler, "create")
	),

	start: () => {
		sqsQueues.backfill.start();
		sqsQueues.push.start();
		sqsQueues.discovery.start();
		sqsQueues.deployment.start();
		sqsQueues.branch.start();
	},

	stop: () => {
		sqsQueues.backfill.stop();
		sqsQueues.push.stop();
		sqsQueues.discovery.stop();
		sqsQueues.deployment.stop();
		sqsQueues.branch.stop();
	}
}

export default sqsQueues
