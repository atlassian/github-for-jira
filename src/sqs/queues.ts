import envVars from "../config/env";
import {SqsQueue} from "./index";
import {BackfillMessagePayload, backfillQueueMessageHandler} from "./backfill";


const sqsQueues = {
	backfill: new SqsQueue<BackfillMessagePayload>({ queueName: "backfill",
		queueUrl: envVars.SQS_BACKFILL_QUEUE_URL,
		queueRegion: envVars.SQS_BACKFILL_QUEUE_REGION,
		longPollingIntervalSec: 3}, backfillQueueMessageHandler),

	start: () => {
		//do nothing
		//sqsQueues.backfill.start();
	},

	stop: () => {
		//do nothing
		//sqsQueues.backfill.stop();
	}
}


export default sqsQueues
