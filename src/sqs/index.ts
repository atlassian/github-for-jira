import AWS from "aws-sdk";
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

	readonly longPollingIntervalSec?: number

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

/**
 * Class which represents an SQS client for a single SQS queue.
 *
 * Allows sending SQS messages, as well as listening to the queue messages.
 */
export class SqsQueue<MessagePayload> {
	readonly queueUrl: string;
	readonly queueName: string;
	readonly queueRegion: string;
  readonly longPollingIntervalSec: number;
	readonly messageHandler: MessageHandler<MessagePayload>
	readonly sqs: SQS;
	readonly log: Logger;

	listenerStatus: ListenerStatus;

	public constructor(settings: QueueSettings, messageHandler: MessageHandler<MessagePayload>) {
		this.queueUrl = settings.queueUrl;
		this.queueName = settings.queueName;
		this.queueRegion = settings.queueRegion;
		this.longPollingIntervalSec = settings.longPollingIntervalSec !== undefined ? settings.longPollingIntervalSec : DEFAULT_LONG_POLLING_INTERVAL
		this.sqs = new AWS.SQS({apiVersion: "2012-11-05", region: settings.queueRegion});
		this.messageHandler = messageHandler;
		this.log = logger.child({queue: this.queueName});
	}

	/**
	 * Send message to the queue
	 * @param payload Message payload
	 * @param delaySec Delay in seconds after which the message will be ready to be processed
	 * @param log Logger to be used to log message sending status
	 */
	public async sendMessage(payload: MessagePayload, delaySec = 0, log: Logger = this.log) {
		const params: SendMessageRequest = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: this.queueUrl,
			DelaySeconds: delaySec
		};
		const sendMessageResult = await this.sqs.sendMessage(params)
			.promise();
		log.info(`Successfully added message to sqs queue messageId: ${sendMessageResult.MessageId}`);
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
			queueRegion: this.queueRegion, longPollingInterval: this.longPollingIntervalSec},"Starting the queue")
		//Every time we start a listener we create a separate ListenerStatus object,
		//This is to make sure that we won't have 2 listeners running at the same time when we restart the listener.
		//Hence the old one can still be processing messages on the moment `start()' been called.
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
	 * @param listenerStatus The object holding a status of this listener. We are keeping it on a function level, because
	 * the next time we call "start" we'll create a new state and override this.listenerStatus with a status for the new listener.
	 * It is to make sure that if we restart the queue, we won't get
	 * 2 listeners running if the old listener didn't finish before "start" being called
	 * (listener can be waiting for the message being processed, or for an sqs message)
	 *
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
			WaitTimeSeconds: this.longPollingIntervalSec
		};

		//Get messages from the queue with long polling enabled
		await this.sqs.receiveMessage(params)
			.promise()
			.then(async result => {
				await this.handleSqsResponse(result)
			})
			.catch((err) => {
				this.log.error({err}, `Error receiving message from SQS queue, queueName ${this.queueName}`);
			})
			.finally( () =>
				this.listen(listenerStatus)
			);
	}


	private async deleteMessage(message: Message, log: Logger) {

		log.debug({ message }, "deleting the message")

		if(!message.ReceiptHandle) {
			log.error({ message }, "Unable to delete message, ReceiptHandle parameter is missing");
			return;
		}

		const deleteParams: DeleteMessageRequest = {
			QueueUrl: this.queueUrl,
			ReceiptHandle: message.ReceiptHandle || ""
		};

		try {
			await this.sqs.deleteMessage(deleteParams)
				.promise()
			log.debug("Successfully deleted message from queue");
		} catch(err) {
			log.warn({err}, "Error deleting message from the queue");
		}
	}

	private async executeMessage(message: Message): Promise<void> {
		const payload = message.Body ? JSON.parse(message.Body) : {};

		const log = logger.child({id: message.MessageId, executionId: uuidv4(), queue: this.queueName})

		const context: Context<MessagePayload> = {message, payload, log }

		log.info("Sqs message received");

		try {
			await this.messageHandler.handle(context)
			await this.deleteMessage(message, log)
		} catch (err) {
			//TODO Add error handling
			log.error({err}, "error executing sqs message")
		}
	}

	async handleSqsResponse(data: ReceiveMessageResult) {
		if (!data.Messages) {
			this.log.debug("Nothing to process");
			return;
		}

		this.log.debug("Processing messages batch")
		await Promise.all(data.Messages.map(async message => {
			await this.executeMessage(message)
		}))
		this.log.debug("Messages batch processed")
	}

}
