import envVars from "../config/env";
import {SqsQueue} from "./index";
import {BackfillMessagePayload, backfillQueueMessageHandlerFactory} from "./backfill";
import {PushQueueMessagePayload, pushQueueMessageHandler} from "./push";
import {jiraOctokitErrorHandler} from './error-handlers';
import backfillQueueSupplier from "../backfill-queue-supplier";

const LONG_POLLING_INTERVAL_SEC = 3;

const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({ queueName: "backfill",
		queueUrl: envVars.SQS_BACKFILL_QUEUE_URL,
		queueRegion: envVars.SQS_BACKFILL_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 10*60,
		maxAttempts: 3
	},
	backfillQueueMessageHandlerFactory(() => backfillQueueSupplier.supply()),
	jiraOctokitErrorHandler
	),

	push: new SqsQueue<PushQueueMessagePayload>({ queueName: "push",
		queueUrl: envVars.SQS_PUSH_QUEUE_URL,
		queueRegion: envVars.SQS_PUSH_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5}, pushQueueMessageHandler,	jiraOctokitErrorHandler),


	start: () => {
		backfillQueueSupplier.setSQSQueue(sqsQueues.backfill);
		sqsQueues.backfill.start();
		sqsQueues.push.start();
	},

	stop: () => {
		sqsQueues.backfill.stop();
		sqsQueues.push.stop();
	}
}

export default sqsQueues
