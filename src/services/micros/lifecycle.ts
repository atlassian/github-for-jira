import envVars from "../../config/env";
import { Consumer, SQSMessage } from "sqs-consumer";
import EventEmitter from "events";
import { getLogger } from "../../config/logger";

const logger = getLogger("micros.lifecycle");
const eventEmitter = new EventEmitter();
let client: Consumer;

export const listenToMicrosLifecycle = (active: Callback, inactive: Callback): void => {
	eventEmitter.on("active", active);
	eventEmitter.on("inactive", inactive);
	if (!client) {
		client = Consumer.create({
			queueUrl: envVars.SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL,
			handleMessage: async (data: SQSMessage): Promise<void> => {
				logger.info(data, "Received Micros lifecycle event");
				if(!data.Body) {
					logger.debug("Lifecycle event missing body, skipping.");
					return;
				}
				try {
					const lifecycleData: LifecycleData = JSON.parse(data.Body);
					if (lifecycleData.Subject === "Micros Lifecycle Notification") {
						const messageData: LifecycleMessageData = JSON.parse(lifecycleData.Message);
						const event = messageData.LifecycleTransition.toLowerCase().replace("micros:", "");
						logger.info({ event, data: messageData }, `Triggering '${event}' lifecycle event`);
						eventEmitter.emit(event, messageData);
					}
				} catch (err) {
					logger.error(err, "Could not parsed JSON data from Micros Lifecycle SQS queue.");
				}
			}
		});
		client.start();
	}
};

type Callback = (data: LifecycleMessageData) => void;

interface LifecycleData {
	Type: string;
	Subject: string;
	Message: string;
}

interface LifecycleMessageData {
	EC2InstanceId: string;
	LifecycleTransition: "micros:ACTIVE" | "micros:INACTIVE";
	TrafficPercentage?: number;
}
