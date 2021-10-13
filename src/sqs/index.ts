import AWS, {AWSError} from "aws-sdk";
import Logger from "bunyan"
import {getLogger} from "../config/logger"
import {DeleteMessageRequest, Message, ReceiveMessageResult} from "aws-sdk/clients/sqs";
import { v4 as uuidv4 } from "uuid";

const logger = getLogger("sqs")

/**
 * Message processing context, which will be passed to message handler to handle the received message
 */
export type Context<MessagePayload> = {

	/**
	 * Message payload
	 */
	payload: MessagePayload;

	/**
	 * Oritinal SQS Mesage
	 */
	message: Message;

	/**
	 * Context logger, which has parameters for the processing context (like message id, execution id, etc)
	 */
	log: Logger;
}

/**
 * Handler for the queue messages
 */
export interface MessageHandler<MessagePayload> {
	handle(context: Context<MessagePayload>): Promise<void>;
}


export class SqsQueue<MessagePayload> {
	queueUrl: string;
	queueName: string;
	queueRegion: string;

	messageHandler: MessageHandler<MessagePayload>

	sqs: AWS.SQS;
	stopped: boolean

	public constructor(queueName: string, queueUrl: string, queueRegion: string, messageHandler: MessageHandler<MessagePayload>) {
		this.queueUrl = queueUrl;
		this.queueName = queueName;
		this.queueRegion = queueRegion;
		this.sqs = new AWS.SQS({apiVersion: "2012-11-05", region: queueRegion});
		this.stopped = false
		this.messageHandler = messageHandler;
	}

	public sendMessage(payload: MessagePayload, log?: Logger) {
		const params = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: this.queueUrl
		};
		this.sqs.sendMessage(params, (err, data) => {
			if (err) {
				( log || logger).error(err, "Error sending SQS message");
			} else {
				( log || logger).info(`Successfully added message to sqs queue messageId: ${data.MessageId}`);
			}
		});
	}

	private deleteMessage(message: Message) {

		if(!message.ReceiptHandle) {
			logger.error({ message }, "Unable to delete message, ReceiptHandle parameter is missing");
			return;
		}

		const deleteParams: DeleteMessageRequest = {
			QueueUrl: this.queueUrl,
			ReceiptHandle: message.ReceiptHandle || ""
		};
		this.sqs.deleteMessage(deleteParams, (err, data) => {
			if (err) {
				logger.error({err, data}, "Error deleting message from the queue");
			} else {
				logger.debug({data}, "Successfully deleted message from queue");
			}
		});
	}

	private async executeMessage(message: Message): Promise<void> {
		const payload = message.Body ? JSON.parse(message.Body) : {};

		const log = logger.child({id: message.MessageId, executionId: uuidv4()})

		const context: Context<MessagePayload> = {message, payload, log }

		log.info({messagePayload: payload}, "Sqs message received");

		try {
			await this.messageHandler.handle(context)
			this.deleteMessage(message)
		} catch (err) {
			log.error(err, "error executing sqs message")
		}
	}

	async handleSqsResponse(err: AWSError, data: ReceiveMessageResult) {
		if (err) {
			logger.error({err}, `Error receiving message from SQS queue, queueName ${this.queueName}`);
		} else {
			if (!data.Messages) {
				logger.debug("Nothing to process");
				return;
			}

			await Promise.all(data.Messages.map(message => {
				this.executeMessage(message)
			})
			)
		}
	}

	public async listen() {
		this.poll();
	}


	private async poll() {

		if(this.stopped) {
			return
		}

		// Setup the receiveMessage parameters
		const params = {
			QueueUrl: this.queueUrl,
			MaxNumberOfMessages: 1,
			VisibilityTimeout: 0,
			WaitTimeSeconds: 1
		};
		//Get messages from the queue with long polling enabled
		this.sqs.receiveMessage(params, async (err, data) => {
			try {
				await this.handleSqsResponse(err, data)
			} finally {
				this.poll()
			}
		});
	}

	public stop() {
		this.stopped = true;
	}
}
