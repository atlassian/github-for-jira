import { Router } from "express";
import {
	deleteMessage, deleteMessages,
	microscopeDlqHealthcheck, queryQueueAttributes, queryQueueMessages, queryQueues, requeueMessage, requeueMessages
} from "routes/microscope/operations/microscope-dlq-operations";

export const MicroscopeDlqRouter = Router();
const subRouter = Router({ mergeParams: true });

subRouter.get("/healthcheck", microscopeDlqHealthcheck);
subRouter.get("/queues", queryQueues);
subRouter.post("/attributes", queryQueueAttributes);
subRouter.get("/queue/:queueName/messages", queryQueueMessages);
subRouter.post("/queue/:queueName/message", requeueMessage);
subRouter.delete("/queue/:queueName/message", deleteMessage);
subRouter.post("/queue/:queueName/requeue", requeueMessages);
subRouter.delete("/queue/:queueName/messages", deleteMessages);
