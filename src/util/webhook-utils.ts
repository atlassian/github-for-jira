import { statsd }  from "config/statsd";
import { metricWebhooks } from "config/metric-names";
import Logger from "bunyan";
import { getLogger } from "config/logger";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const getCurrentTime = () => Date.now();

export const emitWebhookProcessedMetrics = (
	webhookReceivedTime: number,
	webhookName: string,
	jiraHost: string,
	logger: Logger = getLogger("webhook-metrics"),
	status?: number,
	gitHubAppId?: number
): number | undefined | void => {
	const currentTime = getCurrentTime();

	try {
		// only send logs if time of webhookReceived occurred before the currentTime
		// and if webhookReceivedTime is not null/undefined
		if (Number.isInteger(webhookReceivedTime) && webhookReceivedTime <= currentTime) {
			const timeToProcessWebhookEvent = currentTime - webhookReceivedTime;

			logger.info(
				{ webhookName },
				`Webhook processed in ${timeToProcessWebhookEvent} milliseconds`
			);

			const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

			const tags = {
				name: webhookName,
				status: status?.toString() || "none",
				gitHubProduct
			};

			statsd.increment(metricWebhooks.webhookProcessed, tags, { jiraHost });

			// send metrics without gsd_histogram tag so we still have .count, .p99, .median etc
			statsd.histogram(
				metricWebhooks.webhookProcessingTimes,
				timeToProcessWebhookEvent,
				tags,
				{ jiraHost }
			);

			const histogramBuckets =
				"1000_10000_30000_60000_120000_300000_600000_3000000";

			tags["gsd_histogram"] = histogramBuckets;

			// send metrics with gsd_histogram so it will be treated as a histogram-type metric
			statsd.histogram(
				metricWebhooks.webhookLatency,
				timeToProcessWebhookEvent,
				tags,
				{ jiraHost }
			);

			return timeToProcessWebhookEvent;
		} else {
			logger.error(
				{ webhookReceivedTime },
				`Failed to send timeToProcessWebhookEvent metric. webhookReceivedTime: ${webhookReceivedTime}; current time: ${currentTime}.`
			);
			return undefined;
		}
	} catch (err: unknown) {
		logger.error(
			{ err },
			"Failed to send webhook processing time metrics."
		);
	}
};

/**
 * Emits metric for failed webhook
 * @param webhookName
 */
export const emitWebhookFailedMetrics = (webhookName: string, jiraHost: string | undefined) => {

	const tags = {
		name: webhookName
	};

	statsd.increment(metricWebhooks.webhookFailure, tags, { jiraHost });

};


/**
 * Emits metric for webhook payload size
 * @param webhookName
 * @param size
 */
export const emitWebhookPayloadMetrics = (webhookName: string, jiraHost: string | undefined, size: number) => {
	const tags = {
		name: webhookName
	};
	statsd.histogram(
		metricWebhooks.webhookPayloadSize,
		size,
		tags,
		{ jiraHost }
	);

	const histogramBuckets =
		"128000_256000_512000_1024000_2048000"; //buckets in byte size

	tags["gsd_histogram"] = histogramBuckets;

	statsd.histogram(
		metricWebhooks.webhookPayloadSize,
		size,
		tags,
		{ jiraHost }
	);
};
