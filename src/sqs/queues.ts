import envVars from "../config/env";
import {defaultErrorHandler, SqsQueue} from "./index";
import {BackfillMessagePayload, backfillQueueMessageHandler} from "./backfill";
import {PushQueueMessagePayload, pushQueueMessageHandler} from "./push";

const LONG_POLLING_INTERVAL_SEC = 3;

const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({ queueName: "backfill",
		queueUrl: envVars.SQS_BACKFILL_QUEUE_URL,
		queueRegion: envVars.SQS_BACKFILL_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 10*60,
		maxAttempts: 3
	},
	backfillQueueMessageHandler,
	defaultErrorHandler
	),

	push: new SqsQueue<PushQueueMessagePayload>({ queueName: "push",
		queueUrl: envVars.SQS_PUSH_QUEUE_URL,
		queueRegion: envVars.SQS_PUSH_QUEUE_REGION,
		longPollingIntervalSec: LONG_POLLING_INTERVAL_SEC,
		timeoutSec: 60,
		maxAttempts: 5}, pushQueueMessageHandler,	defaultErrorHandler),


	start: () => {
		//do nothing
		//sqsQueues.backfill.start();
		sqsQueues.push.start();
	},

	stop: () => {
		//do nothing
		//sqsQueues.backfill.stop();
		sqsQueues.push.stop();
	}
}


export default sqsQueues
