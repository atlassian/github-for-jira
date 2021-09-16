import AWS from "aws-sdk";
import Logger from "bunyan"
import {getLogger} from "./logger"
import {Message} from "aws-sdk/clients/sqs";
import envVars from "./env";

// All our queues must be in the same region so we can set a global parameter here
AWS.config.update({region: envVars.SQS_WEBHOOKSQS_QUEUE_REGION || "us-west-1"});

// Create SQS service client
const sqs = new AWS.SQS({apiVersion: "2012-11-05"});
const logger = getLogger("config.sqs")

// Replace with your account id and the queue name you setup

export class SqsQueue {
	queueUrl: string;
	queueName: string;

	constructor(queueName: string, queueUrl: string) {
		this.queueUrl = queueUrl;
		this.queueName = queueName;
	}

	sendMessage(payload: any, log?: Logger) {
		log = log || logger
		const params = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: this.queueUrl
		};
		sqs.sendMessage(params, (err, data) => {
			if (err) {
				log.error(err, "Error sending SQS message");
			} else {
				log.info(`Successfully added message to sqs queue messageId: ${data.MessageId}`);
			}
		});
	}

	deleteMessage(message: Message) {
		const deleteParams = {
			QueueUrl: this.queueUrl,
			ReceiptHandle: message.ReceiptHandle
		};
		sqs.deleteMessage(deleteParams, (err, data) => {
			if (err) {
				logger.error({err, data}, "Error deleting message from the queue");
			} else {
				logger.debug({data}, "Successfully deleted message from queue");
			}
		});
	}

	listen(messageHandler) {
		// Setup the receiveMessage parameters
		const params = {
			QueueUrl: this.queueUrl,
			MaxNumberOfMessages: 1,
			VisibilityTimeout: 0,
			WaitTimeSeconds: 0
		};
		sqs.receiveMessage(params, async (err, data) => {
			if (err) {
				logger.error({err}, `Error receiving message from SQS queue, queueName ${this.queueName}`);
			} else {
				if (!data.Messages) {
					logger.debug("Nothing to process");
					return;
				}

				await Promise.all(data.Messages.map(message => {

					return new Promise<void>((resolve) => {
						const messagePayload = JSON.parse(message.Body);
						logger.info({messagePayload}, "Sqs message received");

						try {
							messageHandler({data: messagePayload})
							this.deleteMessage(message)
						} catch (err) {
							logger.error(err, "error executing sqs message")
						}
						resolve()
					})
				})
				)
			}
		});
	}
}

export const sqsQueues: { [key: string]: SqsQueue } = {
	push: new SqsQueue("push", envVars.SQS_WEBHOOKSQS_QUEUE_URL || "http://localhost:9602/queue/webhooksqs")
};
