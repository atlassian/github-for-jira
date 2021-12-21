import envVars from "../config/env";
import { ErrorHandlingResult, SqsQueue } from "./index";
import { BackfillMessagePayload, backfillQueueMessageHandlerFactory } from "./backfill";
import { pushQueueMessageHandler, PushQueueMessagePayload } from "./push";
import { jiraOctokitErrorHandler, webhookMetricWrapper } from "./error-handlers";
import backfillQueueSupplier from "../backfill-queue-supplier";
import { DiscoveryMessagePayload } from "./discovery";
import { DeploymentMessagePayload, deploymentQueueMessageHandler } from "./deployment";

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
	backfillQueueMessageHandlerFactory(() => backfillQueueSupplier.supply()),
	jiraOctokitErrorHandler
	),

	push: new SqsQueue<PushQueueMessagePayload>({
		queueName: "push",
		queueUrl: envVars.SQS_PUSH_QUEUE_URL,
		queueRegion: envVars.SQS_PUSH_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5
	},
	pushQueueMessageHandler,
	webhookMetricWrapper(jiraOctokitErrorHandler, "push")),

	discovery: new SqsQueue<DiscoveryMessagePayload>({
		queueName: "discovery",
		queueUrl: envVars.SQS_DISCOVERY_QUEUE_URL,
		queueRegion: envVars.SQS_DISCOVERY_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 10 * 60,
		maxAttempts: 3
	},
	async () => {
		//TODO Implement
	},
	async (): Promise<ErrorHandlingResult> => ({ retryable: true, isFailure: true })
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
	webhookMetricWrapper(jiraOctokitErrorHandler, "deployment")
	),

	start: () => {
		backfillQueueSupplier.setSQSQueue(sqsQueues.backfill);
		sqsQueues.backfill.start();
		sqsQueues.push.start();
		sqsQueues.discovery.start();
		sqsQueues.deployment.start();
	},

	stop: () => {
		sqsQueues.backfill.stop();
		sqsQueues.push.stop();
		sqsQueues.discovery.stop();
		sqsQueues.deployment.stop();
	}
}

export default sqsQueues
