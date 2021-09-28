import statsd from "../config/statsd";

export const getCurrentTime = () => Date.now();

export const calculateProcessingTimeInSeconds = (
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

			// send metrics without gsd_histogram tag so we still have .count, .p99, .median etc
			statsd.histogram(
				"webhook-event-processing.duration-ms",
				timeToProcessWebhookEvent,
				tags
			);

			const histogramBuckets =
				"1000_10000_30000_60000_120000_300000_600000_3000000";

			tags["gsd_histogram"] = histogramBuckets;

			contextLogger.info(
				{ tags },
				"Sending webhook processing time as histogram metric."
			);

			// send metrics with gsd_histogram so it will be treated as a histogram-type metric
			// https://hello.atlassian.net/wiki/spaces/OBSERVABILITY/pages/797646144/Reference+-+Understanding+histogram-type+metrics#So%2C-how-do-I-get-started%3F
			statsd.histogram(
				"webhook-event-processing.duration-ms",
				timeToProcessWebhookEvent,
				tags
			);

			return timeToProcessWebhookEvent;
		} else {
			return undefined;
		}
	} catch (err) {
		contextLogger?.error(
			{ err },
			"Failed to send webhook processing time metrics."
		);
	}
};
