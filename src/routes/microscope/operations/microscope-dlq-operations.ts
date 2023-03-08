import { Request, Response } from "express";
import Logger from "bunyan";
import { getLogger } from "config/logger";
import { optionalRequire } from "optional-require";

const { DlqService } = optionalRequire("@atlassian/sqs-queue-dlq-service", true) || {};

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

const dlqService = new DlqService(log, {
	sqs: {
		region: process.env.SQS_PUSH_QUEUE_REGION
	}
});


export const microscopeDlqHealthcheck = async (_: Request, res: Response): Promise<void> => {
	res.status(200).send("OK");
};

export const queryQueues = async (_: Request, res: Response): Promise<void> => {
	res.status(200).send(await dlqService.getQueues());
};

export const queryQueueAttributes = async (_: Request, res: Response): Promise<void> => {
	res.status(200).send(await dlqService.getQueuesAttributes());
};

export const queryQueueMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200).send(await dlqService.getMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};

export const requeueMessage = async (req: Request, res: Response): Promise<void> => {
	res.status(200).send(await dlqService.requeueMessage({
		queueName: req.params.queueName,
		message: req.body as RequeueMessageRequest
	}));
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
	res.status(200).send(await dlqService.deleteMessage({
		queueName: req.params.queueName,
		message: req.body as DeleteMessageRequest
	}));
};

export const requeueMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200).send(await dlqService.requeueMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};

export const deleteMessages = async (req: Request, res: Response): Promise<void> => {
	const limit = req.query.limit;

	res.status(200).send(await dlqService.deleteMessages({
		queueName: req.params.queueName,
		limit: limit ? Number(limit) : undefined
	}));
};



