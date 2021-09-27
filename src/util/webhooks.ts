import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";

export const getCurrentTime = () => Date.now();

export const calculateProcessingTimeInSeconds = (
	webhookReceivedTime: number,
	webhookName: string,
	contextLogger: any,
	status?: number
): number | undefined => {
	const currentTime = getCurrentTime();

	// only send logs if time of webhookReceived occurred before the currentTime
	// and if webhookReceivedTime is not null/undefined
	if (webhookReceivedTime < currentTime) {
		const timeToProcessWebhookEvent = getCurrentTime() - webhookReceivedTime;

		contextLogger.info(
			"timeToProcessWebhookEvent: ",
			timeToProcessWebhookEvent
		);

		contextLogger.info(
			{ webhookName },
			`Webhook processed in ${timeToProcessWebhookEvent} milliseconds`
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
	} else {
		return undefined;
	}
};
