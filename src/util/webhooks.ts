import { getLogger } from "../config/logger";
import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";

export const getCurrentTime = () => new Date();

export const calculateProcessingTimeInSeconds = (
	webhookReceivedTime: Date,
	webhookName: string,
	status?: number,
): number => {
	const logger = getLogger("webhookProccessingTime");
	const timeToProcessWebhookEvent =
		(getCurrentTime().getTime() - webhookReceivedTime.getTime()) / 1000;

	logger.info({ webhookName }, `Webhook processed in ${timeToProcessWebhookEvent}`);

	const tags = {
		name: webhookName,
		status: status?.toString() || "none",
	};

	statsd.histogram(
		metricWebhooks.webhookEvent,
		timeToProcessWebhookEvent,
		tags
	);

	return timeToProcessWebhookEvent;
};
