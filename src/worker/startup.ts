import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { statsd } from "config/statsd";
import { metricLag } from "config/metric-names";
import createLag from "event-loop-lag";

const logger = getLogger("worker");

let running = false;

export const start = () => {
	if (running) {
		logger.debug("Worker instance already running, skipping.");
		return;
	}
	const lag = createLag(1000);
	setInterval(() => {
		statsd.histogram(metricLag.lagHist, lag(), { }, { });
	}, 1000);

	logger.info("Micros Lifecycle: Starting queue processing");
	sqsQueues.start();

	running = true;
};

export const stop = async () => {
	if (!running) {
		logger.debug("Worker instance not running, skipping.");
		return;
	}
	logger.info("Micros Lifecycle: Stopping queue processing");

	await sqsQueues.stop();

	running = false;
};
