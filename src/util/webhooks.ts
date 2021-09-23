import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";

export const getCurrentTime = () => new Date();

export const calculateProcessingTimeInSeconds = (
	webhookReceivedTime: Date,
	webhookName: string,
	contextLogger: any,
	status?: number
): number => {
	const timeToProcessWebhookEvent =
		getCurrentTime().getTime() - webhookReceivedTime.getTime();

	contextLogger.info(
		{ webhookName },
		`Webhook processed in ${timeToProcessWebhookEvent}`
	);

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
