import { envVars }  from "config/env";
import { Consumer, SQSMessage } from "sqs-consumer";
import EventEmitter from "events";
import { getLogger } from "config/logger";

const logger = getLogger("micros.lifecycle");
let client: Consumer | undefined;

// Create a single event emitter for all listeners
const eventEmitter = new EventEmitter();
// Listen to Micros Lifecycle Events from SQS: https://hello.atlassian.net/wiki/spaces/MICROS/pages/169248561/Lifecycle+hooks
export const listenToMicrosLifecycle = (active: Callback, inactive: Callback): void => {
	// Subscribe active/inactive callback to our event emitter
	eventEmitter.on("active", active);
	eventEmitter.on("inactive", inactive);

	// Create SQS consumer if not already created - which means we won't be consuming events
	// unless a listener is actually added to prevent missing events at startup
	if (!client) {
		// Throw an error if missing the Environment Variable needed for SQS
		if (!envVars.SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL) {
			const msg = "Missing 'SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL' environment variable for Micros Lifecycle Events.";
			logger.error(msg);
			throw new Error(msg);
		}
		// Create SQS consumer which polls the queue for 1 message at a time and deletes it after handler is called
		client = Consumer.create({
			queueUrl: envVars.SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL,
			region: envVars.SNS_NOTIFICATION_LIFECYCLE_QUEUE_REGION,
			// eslint-disable-next-line @typescript-eslint/require-await
			handleMessage: async (data: SQSMessage) => {
				logger.debug(data, "Received Micros event");
				if (!data.Body) { // Just making sure SQS message has data
					logger.debug("Lifecycle event missing body, skipping.");
					return;
				}
				try {
					const lifecycleData: LifecycleData = JSON.parse(data.Body) as LifecycleData;
					// validate that the data has the required fields
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					if (lifecycleData.Type === undefined || lifecycleData.Subject === undefined || lifecycleData.Message === undefined) {
						logger.error({ data }, "Lifecycle event missing required data, skipping.");
						return;
					}

					// Only continue if it's a micros lifecycle events as there are
					// other internal events on this queue
					if (lifecycleData.Subject === "Micros Lifecycle Notification") {
						logger.info(data, "Received Micros lifecycle event");
						// Need to parse THIS message as well because reasons instead of having it all as flat data
						const notification: LifecycleMessageData = JSON.parse(lifecycleData.Message) as LifecycleMessageData;
						// Get the event name (`active` or `inactive`) from the events, removing the prefix
						const event = notification.LifecycleTransition?.toLowerCase().replace("micros:", "");
						// Check to make sure `LifecycleTransition` was actually set
						if (event) {
							logger.info({ event, data: notification }, `Triggering '${event}' lifecycle event`);
							eventEmitter.emit(event, notification);
						}
					}
				} catch (err: unknown) {
					logger.error(err, "Could not parsed JSON data from Micros Lifecycle SQS queue.");
				}
			}
		});
		// Start processing messages
		client.start();
	}
};

type Callback = (data: LifecycleMessageData) => void;

// Lifecycle SQS data comes in as type, subject and message
// We're interested in type "Notification" and Subject "Micros Lifecycle Notification"
// There are also messages on this queue used internally
interface LifecycleData {
	Type: string;
	Subject: string;
	Message: string;
}

interface LifecycleMessageData {
	EC2InstanceId?: string;
	LifecycleTransition?: "micros:ACTIVE" | "micros:INACTIVE";
	TrafficPercentage?: number; // if doing weighted load balancing, can be any number between 0 and 100.
}
