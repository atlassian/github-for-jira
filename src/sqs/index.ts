import AWS, {AWSError} from "aws-sdk";
import Logger from "bunyan"
import {getLogger} from "../config/logger"
import {DeleteMessageRequest, Message, ReceiveMessageResult, SendMessageRequest} from "aws-sdk/clients/sqs";
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

export type QueueSettings = {

	queueName: string,

	queueUrl: string,

	queueRegion: string,

	longPollingInterval: number

	//TODO Add concurrency

	//TODO Add batching
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
	settings: QueueSettings;

	messageHandler: MessageHandler<MessagePayload>

	sqs: AWS.SQS;
	stopped: boolean

	public constructor(settings: QueueSettings, messageHandler: MessageHandler<MessagePayload>) {
		this.settings = settings;
		this.queueUrl = settings.queueUrl;
		this.queueName = settings.queueName;
		this.queueRegion = settings.queueRegion;
		this.sqs = new AWS.SQS({apiVersion: "2012-11-05", region: settings.queueRegion});
		this.stopped = false
		this.messageHandler = messageHandler;
	}

	/**
	 * Send message to the queue
	 * @param payload Message payload
	 * @param log Logger to be used to log message sending status
	 */
	public sendMessage(payload: MessagePayload, delay?: number, log?: Logger) {
		const params : SendMessageRequest = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: this.queueUrl,
			DelaySeconds: delay || 0
		};
		this.sqs.sendMessage(params, (err, data) => {
			if (err) {
				( log || logger).error(err, "Error sending SQS message");
			} else {
				( log || logger).info(`Successfully added message to sqs queue messageId: ${data.MessageId}`);
			}
		});
	}

	/**
	 * Starts listening to the queue asynchronously
	 */
	public async listen() {
		this.poll();
	}

	/**
	 * Stops reading messages from the queue. When stopped it can't be resumed.
	 */
	public stop() {
		this.stopped = true;
	}

	private deleteMessage(message: Message) {

		logger.debug({message}, "deleting the message")

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

			logger.debug("Processing messages batch")
			await Promise.all(data.Messages.map(async message => {
				await this.executeMessage(message)
			}))
			logger.debug("Messages batch processed")
		}
	}

	private async poll() {

		if(this.stopped) {
			logger.info("Queue stopped finishing processing")
			return
		}

		// Setup the receiveMessage parameters
		const params = {
			QueueUrl: this.queueUrl,
			MaxNumberOfMessages: 1,
			WaitTimeSeconds: this.settings.longPollingInterval
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
}
