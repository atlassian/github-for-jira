import envVars from "../config/env";
import {SqsQueue} from "./index";
import {BackfillMessagePayload, backfillQueueMessageHandler} from "./backfill";


const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({ queueName: "backfill",
		queueUrl: envVars.BACKFILL_QUEUE_URL,
		queueRegion: envVars.MICROS_AWS_REGION,
		longPollingIntervalSec: 3}, backfillQueueMessageHandler),

	start: () => {
		sqsQueues.backfill.start();
	},

	stop: () => {
		sqsQueues.backfill.stop();
	}
}


export default sqsQueues
