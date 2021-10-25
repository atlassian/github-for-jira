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

	readonly longPollingIntervalSec?: number,

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

type ListenerContext = {
	/**
	 * Indicates if this listener should stop processing messages.
	 *
	 * If it is "true" the listener won't take new messages for processing, however, it might
	 * still be finishing with the current message.
	 */
	stopped: boolean;
	/**
	 * Indicates if this listener stopped processing messages.
	 *
	 * If it is "false" that mean that the listener was stopped and it is done with its last
	 * message.
	 */
	listenerRunning: boolean;

	/**
	 * Logger which contains listener debug parameters
	 */
	log: Logger;
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

	/**
	 * Context of the currently active listener, or the last active if the queue stopped
	 */
	listenerContext: ListenerContext;

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
	 * Starts listening to the queue, times out in 1 minute
	 */
	public start() {

		//This checks if the previous listener was stopped or never created. However it could be that the
		//previous listener is stopped, but still processing its last message
		if(this.listenerContext && !this.listenerContext.stopped) {
			this.log.error("Queue is already running")
			return;
		}

		//Every time we start a listener we create a separate ListenerContext object. There can be more than 1 listeners
		//running at the same time, if the previous listener still processing its last message
		this.listenerContext = {stopped: false, log: this.log.child({sqsListenerId: uuidv4()}), listenerRunning: true}
		this.listenerContext.log.info({queueUrl: this.queueUrl,
			queueRegion: this.queueRegion, longPollingInterval: this.longPollingIntervalSec},"Starting the queue")
		this.listen(this.listenerContext)
	}


	/**
	 * Stops reading messages from the queue. When stopped it can't be resumed.
	 */
	public stop() {
		if(!this.listenerContext || this.listenerContext.stopped) {
			this.log.error("Queue is already stopped")
			return;
		}
		this.listenerContext.log.info("Stopping the queue");
		this.listenerContext.stopped = true;
	}


	/**
	 * Function which is used for testing. Awaits until the currently stopped listener finished with
	 * processing its last message
	 */
	public async waitUntilListenerStopped() {
		const listenerContext = this.listenerContext;

		if(!listenerContext.stopped) {
			throw new Error("Listener is not stopped, nothing to await")
		}

		return new Promise<void>((resolve, reject) => {
			const startTime = Date.now();
			function checkFlag() {
				if (!listenerContext.listenerRunning) {
					listenerContext.log.info("Awaited listener stop");
					resolve();
				} else if (Date.now() - startTime > 60000) {
					reject("Listener didn't stop in 1 minute");
				} else {
					setTimeout(checkFlag, 10);
				}
			}
			checkFlag();
		});
	}

	/**
	 * Starts listening to the queue asynchronously
	 *
	 * @param listenerContext The object holding a status of this listener. This object keeps parameters specific to the
	 * particular queue listener. These parameters are not kept on SqsQueue level, hence there might be more than 1 listener
	 * running at the same time
	 *
	 */
	private async listen(listenerContext: ListenerContext) {
		if(listenerContext.stopped) {
			listenerContext.listenerRunning = false;
			listenerContext.log.info("Queue has been stopped. Not processing further messages.");
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
				await this.handleSqsResponse(result, listenerContext)
			})
			.catch((err) => {
				listenerContext.log.error({err}, `Error receiving message from SQS queue, queueName ${this.queueName}`);
			})
			.finally( () =>
				this.listen(listenerContext)
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

	private async executeMessage(message: Message, listenerContext: ListenerContext): Promise<void> {
		const payload = message.Body ? JSON.parse(message.Body) : {};

		const log = listenerContext.log.child({id: message.MessageId,
			executionId: uuidv4(),
			queue: this.queueName})

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

	async handleSqsResponse(data: ReceiveMessageResult, listenerContext: ListenerContext) {
		if (!data.Messages) {
			listenerContext.log.trace("Nothing to process");
			return;
		}

		listenerContext.log.trace("Processing messages batch")
		await Promise.all(data.Messages.map(async message => {
			await this.executeMessage(message, listenerContext)
		}))
		listenerContext.log.trace("Messages batch processed")
	}

}
