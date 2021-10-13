import envVars from "../config/env";
import {SqsQueue} from "./index";

export type BackfillQueueMessagePayload = {jobId:string};

export const sqsQueues: { [key: string]: SqsQueue<BackfillQueueMessagePayload> } = {
	push: new SqsQueue("push", envVars.SQS_BACKFILL_QUEUE_URL || "http://localhost:9602/queue/backfill",
		envVars.SQS_BACKFILL_QUEUE_REGION || "us-west-1")
};
