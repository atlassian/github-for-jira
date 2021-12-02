import AWS from "aws-sdk";
import Logger from "bunyan"
import {getLogger} from "../config/logger"
import SQS, {
	ChangeMessageVisibilityRequest,
	DeleteMessageRequest,
	Message,
	ReceiveMessageResult,
	SendMessageRequest
} from "aws-sdk/clients/sqs";
import { v4 as uuidv4 } from "uuid";
import statsd from "../config/statsd";
import { Tags } from "hot-shots";
import {sqsQueueMetrics} from "../config/metric-names";
import {LoggerWithTarget} from "probot/lib/wrap-logger";

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
	 * Original SQS Mesage
	 */
	message: Message;

	/**
	 * Context logger, which has parameters for the processing context (like message id, execution id, etc)
	 */
	log: LoggerWithTarget;

	/**
	 * How many times this messages attempted to be processed, including the current attempt (always greater 0)
	 */
	receiveCount: number;


	/**
	 * Indicates if it is the last attempt to process this message
	 */
	lastAttempt: boolean;
}

export type QueueSettings = {

	readonly queueName: string,

	readonly queueUrl: string,

	readonly queueRegion: string,

	readonly longPollingIntervalSec?: number,

	/**
	 * Timeout for processing a single message in seconds
	 */
	readonly timeoutSec: number;

	/**
	 * Defines how many times the message can be attempted to be executed
	 */
	readonly maxAttempts: number;

	//TODO Add batching

}

const DEFAULT_LONG_POLLING_INTERVAL = 4

const PROCESSING_DURATION_HISTOGRAM_BUCKETS =	"10_100_500_1000_2000_3000_5000_10000_30000_60000";

/**
 * Error indicating a timeout
 */
export class SqsTimeoutError extends Error {
}
/**
 * Handler for the queue messages
 */
export type MessageHandler<MessagePayload> = (context: Context<MessagePayload>) => Promise<void>;

export type ErrorHandler<MessagePayload> = (error: Error, context: Context<MessagePayload>) => Promise<ErrorHandlingResult>;

/**
 * Trivial error handler which classifies all errros as retryable
 */
export const defaultErrorHandler = async () => ({retryable: true});

export type ErrorHandlingResult = {


	/**
	 * Indicates if the message should be deleted or retried
	 */
	retryable: boolean;

	/**
	 * Number in seconds of the retry delay
	 */
	retryDelaySec ?: number;

	/**
	 * If set to true, the message will be deleted when the maximum amount of retries reacched
	 */
	skipDlq ?: boolean;

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
	log: LoggerWithTarget;
}

const EXTRA_VISIBILITY_TIMEOUT_DELAY = 2;

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
	readonly timeoutSec: number;
	readonly maxAttempts: number;
	readonly errorHandler: ErrorHandler<MessagePayload>;
	readonly messageHandler: MessageHandler<MessagePayload>;
	readonly sqs: SQS;
	readonly log: LoggerWithTarget;
	readonly metricsTags: Tags;

	/**
	 * Context of the currently active listener, or the last active if the queue stopped
	 */
	listenerContext: ListenerContext;

	public constructor(settings: QueueSettings, messageHandler: MessageHandler<MessagePayload>, errorHandler: ErrorHandler<MessagePayload>) {
		this.queueUrl = settings.queueUrl;
		this.queueName = settings.queueName;
		this.queueRegion = settings.queueRegion;
		this.longPollingIntervalSec = settings.longPollingIntervalSec !== undefined ? settings.longPollingIntervalSec : DEFAULT_LONG_POLLING_INTERVAL
		this.sqs = new AWS.SQS({apiVersion: "2012-11-05", region: settings.queueRegion});
		this.timeoutSec = settings.timeoutSec;
		this.maxAttempts = settings.maxAttempts;
		this.messageHandler = messageHandler;
		this.errorHandler = errorHandler;
		this.log = logger.child({queue: this.queueName});
		this.metricsTags = {queue: this.queueName};
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
		statsd.increment(sqsQueueMetrics.sent, this.metricsTags);
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
			WaitTimeSeconds: this.longPollingIntervalSec,
			AttributeNames: ["ApproximateReceiveCount"]
		};

		try {
			//Get messages from the queue with long polling enabled
			const result = await this.sqs.receiveMessage(params)
				.promise();

			await this.handleSqsResponse(result, listenerContext)
		} catch(err) {
			listenerContext.log.error({err}, `Error receiving message from SQS queue`);
			//In case of aws client error we wait for the long polling interval to prevent bombarding the queue with failing requests
			await new Promise(resolve => setTimeout(resolve, this.longPollingIntervalSec * 1000));
		} finally {
			this.listen(listenerContext)
		}
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
			statsd.increment(sqsQueueMetrics.deleted, this.metricsTags)
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

		const receiveCount = Number(message.Attributes?.ApproximateReceiveCount || "1");

		const context: Context<MessagePayload> = {message, payload, log, receiveCount: receiveCount, lastAttempt: receiveCount >= this.maxAttempts}

		log.info(`SQS message received. Receive count: ${receiveCount}`);

		try {
			const messageProcessingStartTime = new Date().getTime();

			// Change message visibility timeout to the max processing time
			// plus EXTRA_VISIBILITY_TIMEOUT_DELAY to have some room for error handling in case of a timeout
			await this.changeVisabilityTimeout(message, this.timeoutSec + EXTRA_VISIBILITY_TIMEOUT_DELAY, log);

			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new SqsTimeoutError()), this.timeoutSec*1000)
			);

			await Promise.race([this.messageHandler(context), timeoutPromise])

			const messageProcessingDuration = new Date().getTime() - messageProcessingStartTime;
			this.sendProcessedMetrics(messageProcessingDuration);
			await this.deleteMessage(message, log)
		} catch (err) {

			statsd.increment(sqsQueueMetrics.failed, this.metricsTags)
			log.error({err}, "Error while executing SQS message")

			try {
				const errorHandlingResult = await this.errorHandler(err, context);
				if (!errorHandlingResult.retryable) {
					log.info("Deleting the message because it is not retryable")
					await this.deleteMessage(message, log)
				} else if (errorHandlingResult.skipDlq && context.receiveCount >= this.maxAttempts) {
					log.info("Deleting the message because it has reached the maximum amount of retries")
					await this.deleteMessage(message, log)
				} else if (errorHandlingResult.retryDelaySec !== undefined /*zero seconds delay is also supported*/) {
					log.info(`Delaying the retry for ${errorHandlingResult.retryDelaySec} seconds`)
					await this.changeVisabilityTimeout(message, errorHandlingResult.retryDelaySec, log);
				}
			} catch (err) {
				log.error({err}, "Error while performing error handling");
			}
		}
	}

	private async changeVisabilityTimeout(message: Message, timeout: number, logger: Logger): Promise<void> {

		if(!message.ReceiptHandle) {
			logger.error(`No ReceiptHandle in message with ID = ${message.MessageId}`)
			return;
		}

		const params : ChangeMessageVisibilityRequest = {
			QueueUrl: this.queueUrl,
			ReceiptHandle: message.ReceiptHandle,
			VisibilityTimeout: timeout
		} ;
		try {
			await this.sqs.changeMessageVisibility(params).promise()
		} catch (err) {
			logger.error("Message visibility timeout change failed")
		}
	}

	private sendProcessedMetrics(messageProcessingDuration: number) {
		statsd.increment(sqsQueueMetrics.completed, this.metricsTags)
		//Sending histogram metric twice hence it will produce different metrics, first call produces mean, min, max and precentiles metrics
		statsd.histogram(sqsQueueMetrics.duration, messageProcessingDuration, this.metricsTags);
		//the second call produces only histogram buckets metrics
		statsd.histogram(sqsQueueMetrics.duration, messageProcessingDuration, {
			...this.metricsTags,
			gsd_histogram: PROCESSING_DURATION_HISTOGRAM_BUCKETS
		})
	}

	async handleSqsResponse(data: ReceiveMessageResult, listenerContext: ListenerContext) {
		if (!data.Messages) {
			listenerContext.log.trace("Nothing to process");
			return;
		}

		statsd.increment(sqsQueueMetrics.received, data.Messages.length, this.metricsTags);

		listenerContext.log.trace("Processing messages batch")
		await Promise.all(data.Messages.map(async message => {
			await this.executeMessage(message, listenerContext)
		}))
		listenerContext.log.trace("Messages batch processed")
	}

}
