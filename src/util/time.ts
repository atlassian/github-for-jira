import { getLogger } from "../config/logger";
import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";

export const getCurrentTime = () => new Date();

const logger = getLogger("time");

export const calculateProcessingTimeInSeconds = (
	webhookReceivedTime: Date,
	webhookName: string
): number => {
	const timeToProcessWebhookEvent =
		getCurrentTime().getTime() - webhookReceivedTime.getTime() / 1000;

	logger.info({ webhookName, timeToProcessWebhookEvent }, "Webhook processed");

	statsd.histogram(
		metricWebhooks.webhookEventProcessed,
		timeToProcessWebhookEvent,
		{ name: webhookName }
	);

	return timeToProcessWebhookEvent;
};
