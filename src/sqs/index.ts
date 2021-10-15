import AWS, {AWSError} from "aws-sdk";
import Logger from "bunyan"
import {getLogger} from "../config/logger"
import SQS, {DeleteMessageRequest, Message, ReceiveMessageResult, SendMessageRequest} from "aws-sdk/clients/sqs";
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

	readonly queueName: string,

	readonly queueUrl: string,

	readonly queueRegion: string,

	readonly longPollingInterval?: number

	//TODO Add batching

	//TODO Add error handling

	//TODO Add message processing timeouts
}

const DEFAULT_LONG_POLLING_INTERVAL = 4

/**
 * Handler for the queue messages
 */
export interface MessageHandler<MessagePayload> {
	handle(context: Context<MessagePayload>): Promise<void>;
}

type ListenerStatus = {
	stopped: boolean;
}

export class SqsQueue<MessagePayload> {
	readonly queueUrl: string;
	readonly queueName: string;
	readonly queueRegion: string;
  readonly longPollingInterval: number;
	readonly messageHandler: MessageHandler<MessagePayload>
	readonly sqs: SQS;
	readonly log: Logger;

	listenerStatus: ListenerStatus;

	public constructor(settings: QueueSettings, messageHandler: MessageHandler<MessagePayload>) {
		this.queueUrl = settings.queueUrl;
		this.queueName = settings.queueName;
		this.queueRegion = settings.queueRegion;
		this.longPollingInterval = settings.longPollingInterval !== undefined ? settings.longPollingInterval : DEFAULT_LONG_POLLING_INTERVAL
		this.sqs = new AWS.SQS({apiVersion: "2012-11-05", region: settings.queueRegion});
		this.messageHandler = messageHandler;
		this.log = logger.child({queue: this.queueName});
	}

	/**
	 * Send message to the queue
	 * @param payload Message payload
	 * @param delay Delay after which the message will be ready to be processed
	 * @param log Logger to be used to log message sending status
	 */
	public sendMessage(payload: MessagePayload, delay = 0, log: Logger = this.log) {
		const params : SendMessageRequest = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: this.queueUrl,
			DelaySeconds: delay || 0
		};
		this.sqs.sendMessage(params, (err, data) => {
			if (err) {
				log.error(err, "Error sending SQS message");
			} else {
				log.info(`Successfully added message to sqs queue messageId: ${data.MessageId}`);
			}
		});
	}

	/**
	 * Starts listening to the queue
	 */
	public start() {

		if(this.listenerStatus && !this.listenerStatus.stopped) {
			this.log.error("Queue is already running")
			return;
		}
		this.log.info({queueUrl: this.queueUrl,
			queueRegion: this.queueRegion, longPollingInterval: this.longPollingInterval},"Starting the queue")
		//Every time we start a listener we create a separate ListenerStatus object,
		//This is to make sure that we won't have 2 listeners running at the same time
		//if the previous listener was stopped but still processing its current message
		this.listenerStatus = {stopped: false}
		this.listen(this.listenerStatus)
	}


	/**
	 * Stops reading messages from the queue. When stopped it can't be resumed.
	 */
	public stop() {
		if(!this.listenerStatus || this.listenerStatus.stopped) {
			this.log.error("Queue is already stopped")
			return;
		}
		this.log.info("Stopping the queue");
		this.listenerStatus.stopped = true;
	}
	/**
	 * Starts listening to the queue asynchronously
	 *
	 * @param listenerStatus The object holding a status of this listener. We are keeping it on a function level,
	 * to make sure that we won't run into
	 */
	private async listen(listenerStatus: ListenerStatus) {
		if(listenerStatus.stopped) {
			this.log.info("Queue has been stopped. Not processing further messages.");
			return
		}

		// Setup the receiveMessage parameters
		const params = {
			QueueUrl: this.queueUrl,
			MaxNumberOfMessages: 1,
			WaitTimeSeconds: this.longPollingInterval
		};
		//Get messages from the queue with long polling enabled
		this.sqs.receiveMessage(params, async (err, data) => {
			try {
				await this.handleSqsResponse(err, data)
			} finally {
				this.listen(listenerStatus)
			}
		});
	}


	private deleteMessage(message: Message) {

		logger.debug({ message }, "deleting the message")

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
				logger.warn({err, data}, "Error deleting message from the queue");
			} else {
				logger.debug({data}, "Successfully deleted message from queue");
			}
		});
	}

	private async executeMessage(message: Message): Promise<void> {
		const payload = message.Body ? JSON.parse(message.Body) : {};

		const log = logger.child({id: message.MessageId, executionId: uuidv4(), queue: this.queueName})

		const context: Context<MessagePayload> = {message, payload, log }

		log.info("Sqs message received");

		try {
			await this.messageHandler.handle(context)
			this.deleteMessage(message)
		} catch (err) {
			//TODO Add error handling
			log.error({err}, "error executing sqs message")
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
}
