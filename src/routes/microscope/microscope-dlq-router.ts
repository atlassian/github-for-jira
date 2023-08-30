import { Request, Response, Router } from "express";
import {
	deleteMessage, deleteMessages,
	microscopeDlqHealthcheck, queryQueueAttributes, queryQueueMessages, queryQueues, requeueMessage, requeueMessages
} from "routes/microscope/operations/microscope-dlq-operations";
import { createHashWithSharedSecret } from "utils/encryption";

export const debugIt = async (req: Request, res: Response): Promise<void> => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const jiraHost: string = req.query?.jiraHost || "";
	const hashedValue = createHashWithSharedSecret(jiraHost);
	res.send(hashedValue);
};

export const MicroscopeDlqRouter = Router();

MicroscopeDlqRouter.get("/healthcheck", microscopeDlqHealthcheck);
MicroscopeDlqRouter.get("/queues", queryQueues);
MicroscopeDlqRouter.post("/attributes", queryQueueAttributes);
MicroscopeDlqRouter.get("/queue/:queueName/messages", queryQueueMessages);
MicroscopeDlqRouter.post("/queue/:queueName/message", requeueMessage);
MicroscopeDlqRouter.delete("/queue/:queueName/message", deleteMessage);
MicroscopeDlqRouter.post("/queue/:queueName/requeue", requeueMessages);
MicroscopeDlqRouter.delete("/queue/:queueName/messages", deleteMessages);
MicroscopeDlqRouter.delete("/debugTenant/:jirahost", debugIt);
