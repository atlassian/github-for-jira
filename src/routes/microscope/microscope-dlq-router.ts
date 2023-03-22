import { Router } from "express";
import {
	deleteMessage, deleteMessages,
	microscopeDlqHealthcheck, queryQueueAttributes, queryQueueMessages, queryQueues, requeueMessage, requeueMessages
} from "routes/microscope/operations/microscope-dlq-operations";
import Logger from "bunyan";
import { getLogger } from "config/logger";
import { optionalRequire } from "optional-require";

const { DlqService } = optionalRequire("@atlassian/sqs-queue-dlq-service", true) || {};

const log: Logger = getLogger("microscope-dlq");

const getDlqServiceClient =() => {
	if (!DlqService) {
		log.info("No dlqService package - skipping dlq operations");
		return;
	}
	else {
		return new DlqService(log, {
			sqs: {
				region: process.env.SQS_PUSH_QUEUE_REGION
			}
		});
	}
};

export const MicroscopeDlqRouter = Router();
const subRouter = Router({ mergeParams: true });

subRouter.get("/healthcheck", microscopeDlqHealthcheck, getDlqServiceClient());
subRouter.get("/queues", queryQueues);
subRouter.post("/attributes", queryQueueAttributes);
subRouter.get("/queue/:queueName/messages", queryQueueMessages);
subRouter.post("/queue/:queueName/message", requeueMessage);
subRouter.delete("/queue/:queueName/message", deleteMessage);
subRouter.post("/queue/:queueName/requeue", requeueMessages);
subRouter.delete("/queue/:queueName/messages", deleteMessages);
