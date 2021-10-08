import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";

export const getCurrentTime = () => Date.now();

/**
 * Emits metrics for successfully processed webhook. These metrics include:
 *  - Webhook processing duration histogram
 *  - Processed webhooks counter
 *
 * @param webhookReceivedTime time when GitHub for Jira app received a webhook from GitHub
 * @param webhookName name of the webhook (type)
 * @param contextLogger logger for the function logs
 * @param status http response code if applicable to this webhook type
 */
export const emitWebhookProcessedMetrics = (
	webhookReceivedTime: number,
	webhookName: string,
	contextLogger: any,
	status?: number
): number | undefined | void => {
	const currentTime = getCurrentTime();

	try {
		// only send logs if time of webhookReceived occurred before the currentTime
		// and if webhookReceivedTime is not null/undefined
		if (webhookReceivedTime < currentTime) {
			const timeToProcessWebhookEvent = getCurrentTime() - webhookReceivedTime;

			contextLogger.info(
				{ webhookName },
				`Webhook processed in ${timeToProcessWebhookEvent} milliseconds`
			);

			const tags = {
				name: webhookName,
				status: status?.toString() || "none",
			};

			statsd.increment(metricWebhooks.webhookProcessed, tags);

			// send metrics without gsd_histogram tag so we still have .count, .p99, .median etc
			statsd.histogram(
				metricWebhooks.webhookProcessingTimes,
				timeToProcessWebhookEvent,
				tags
			);

			const histogramBuckets =
				"1000_10000_30000_60000_120000_300000_600000_3000000";

			tags["gsd_histogram"] = histogramBuckets;

			// send metrics with gsd_histogram so it will be treated as a histogram-type metric
			statsd.histogram(
				metricWebhooks.webhookLatency,
				timeToProcessWebhookEvent,
				tags
			);

			return timeToProcessWebhookEvent;
		} else {
			contextLogger?.error(
				{ webhookReceivedTime },
				"Failed to send timeToProcessWebhookEvent metric. webhookReceivedTime is not a number."
			);
			return undefined;
		}
	} catch (err) {
		contextLogger?.error(
			{ err },
			"Failed to send webhook processing time metrics."
		);
	}
};

/**
 * Emits metric for failed webhook
 * @param webhookName
 */
export const emitWebhookFailedMetrics = (webhookName: string) => {

	const tags = {
		name: webhookName,
	};

	statsd.increment(metricWebhooks.webhookFailure, tags);

}
