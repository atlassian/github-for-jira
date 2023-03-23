import { Request, Response } from "express";
import Logger from "bunyan";
import { getLogger } from "config/logger";
// import { optionalRequire } from "optional-require";
//
// const { DlqService } = optionalRequire("@atlassian/sqs-queue-dlq-service", true) || {};

import { DlqService } from "@atlassian/sqs-queue-dlq-service";

const log: Logger = getLogger("microscope-dlq");

type RequeueMessageRequest = {
	messageId: string;
	receiptHandle: string;
	body: string;
	messageAttributes: object;
};

type DeleteMessageRequest = {
	receiptHandle: string;
};

// let dlqServiceClient;
//
// if (!DlqService) {
// 	log.info("No dlqService package - skipping dlq operations");
// } else {
// 	dlqServiceClient = new DlqService(log, {
// 		sqs: {
// 			region: process.env.SQS_PUSH_QUEUE_REGION
// 		}
// 	});
// }

const dlqServiceClient = new DlqService(log, {
	sqs: {
		region: process.env.SQS_PUSH_QUEUE_REGION
	}
});

export const microscopeDlqHealthcheck = async (_: Request, res: Response): Promise<void> => {
	res.status(200);
	res.send("OK");
};

export const queryQueues = async (_: Request, res: Response): Promise<void> => {
	res.status(200);
	res.send(await dlqServiceClient.getQueues());
};

export const queryQueueAttributes = async (_: Request, res: Response): Promise<void> => {
	res.status(200);
	res.send(await dlqServiceClient.getQueuesAttributes());
};

export const queryQueueMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200);
	res.send(await dlqServiceClient.getMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};

export const requeueMessage = async (req: Request, res: Response): Promise<void> => {
	res.status(200);
	res.send(await dlqServiceClient.requeueMessage({
		queueName: req.params.queueName,
		message: req.body as RequeueMessageRequest
	}));
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
	res.status(200);
	res.send(await dlqServiceClient.deleteMessage({
		queueName: req.params.queueName,
		message: req.body as DeleteMessageRequest
	}));
};

export const requeueMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200);
	res.send(await dlqServiceClient.requeueMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};

export const deleteMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200);
	res.send(await dlqServiceClient.deleteMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};



