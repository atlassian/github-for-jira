import { metricHttpRequest } from "../config/metric-names";
import statsd from "../config/statsd";
import { Subscription } from "../models";
import {LoggerWithTarget} from "probot/lib/wrap-logger";

export const METRICS_LOGGER_NAME = "metrics-job";

export default async (_: unknown, logger: LoggerWithTarget): Promise<void> => {
	logger.info("Received sync status metrics event. Getting sync status count for sync status metrics.");
	const syncStatusCounts = await Subscription.syncStatusCounts();

	syncStatusCounts.forEach((row) => {
		statsd.gauge(metricHttpRequest.requestStatusSync, row.count, {
			status: row.syncStatus
		});
	});
};
