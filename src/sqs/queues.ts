import envVars from "../config/env";
import {SqsQueue} from "./index";
import {BackfillMessagePayload, backfillQueueMessageHandler} from "./backfill";


const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({ queueName: "backfill",
		queueUrl: envVars.SQS_BACKFILL_QUEUE_URL || "http://localhost:9602/queue/backfill",
		queueRegion: envVars.SQS_BACKFILL_QUEUE_REGION || "us-west-1",
		longPollingIntervalSec: 3}, backfillQueueMessageHandler),

	start: () => {
		sqsQueues.backfill.start();
	},

	stop: () => {
		sqsQueues.backfill.stop();
	}
}


export default sqsQueues
