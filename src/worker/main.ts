import "../config/env"; // Important to be before other dependencies
import "../config/proxy"; // Important to be before other dependencies
import * as Sentry from "@sentry/node";

import { discovery } from "../sync/discovery";
import { processInstallation } from "../sync/installation";
import { processPushJob } from "../transforms/push";
import metricsJob from "./metrics-job";
import statsd from "../config/statsd";
import app, { probot } from "./app";
import AxiosErrorEventDecorator from "../models/axios-error-event-decorator";
import SentryScopeProxy from "../models/sentry-scope-proxy";
import { initializeSentry } from "../config/sentry";
import { getLogger } from "../config/logger";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { RateLimitingError } from "../config/enhance-octokit";
import { queues } from "./queues";
import { queueMetrics } from "../config/metric-names";
import { Job } from "bull";

const CONCURRENT_WORKERS = process.env.CONCURRENT_WORKERS || 1;
const logger = getLogger("worker.main");

/**
 * Return an async function that assigns a Sentry hub to `job.sentry` and sends exceptions.
 */
const sentryMiddleware = (jobHandler) => async (job) => {
	job.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
	job.sentry.configureScope((scope) =>
		scope.addEventProcessor(AxiosErrorEventDecorator.decorate)
	);
	job.sentry.configureScope((scope) =>
		scope.addEventProcessor(SentryScopeProxy.processEvent)
	);

	try {
		await jobHandler(job);
	} catch (err) {
		job.sentry.setExtra("job", {
			id: job.id,
			attemptsMade: job.attemptsMade,
			timestamp: new Date(job.timestamp),
			data: job.data
		});

		job.sentry.setTag("jiraHost", job.data.jiraHost);
		job.sentry.setTag("queue", job.queue.name);
		job.sentry.captureException(err);

		throw err;
	}
};

const setDelayOnRateLimiting = (jobHandler) => async (job: Job) => {
	try {
		await jobHandler(job);
	} catch (err) {
		if (err instanceof RateLimitingError) {
			// delaying until the rate limit is reset (plus a buffer of a couple seconds)
			const delay = err.rateLimitReset * 1000 + 10000 - new Date().getTime();

			if (delay <= 0) {
				logger.warn({ job }, "Rate limiting detected but couldn't calculate delay, delaying exponentially");
				job.opts.backoff = {
					type: "exponential",
					delay: 10 * 60 * 1000
				};
			} else {
				logger.warn({ job }, `Rate limiting detected, delaying job by ${delay} ms`);
				job.opts.backoff = {
					type: "fixed",
					delay: delay
				};
			}
		}
		throw err;
	}
};

const sendQueueMetrics = async () => {
	if (await booleanFlag(BooleanFlags.EXPOSE_QUEUE_METRICS, false)) {

		for (const [queueName, queue] of Object.entries(queues)) {
			const jobCounts = await queue.getJobCounts();

			logger.info({ queue: queueName, queueMetrics: jobCounts }, "publishing queue metrics");

			const tags = { queue: queueName };
			statsd.gauge(queueMetrics.active, jobCounts.active, tags);
			statsd.gauge(queueMetrics.completed, jobCounts.completed, tags);
			statsd.gauge(queueMetrics.delayed, jobCounts.delayed, tags);
			statsd.gauge(queueMetrics.failed, jobCounts.failed, tags);
			statsd.gauge(queueMetrics.waiting, jobCounts.waiting, tags);
		}
	}
};

const commonMiddleware = (jobHandler) => sentryMiddleware(setDelayOnRateLimiting(jobHandler));

export const start = (): void => {
	initializeSentry();

	// exposing queue metrics at a regular interval
	setInterval(sendQueueMetrics, 60000);

	queues.discovery.process(5, commonMiddleware(discovery(app, queues)));
	queues.installation.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processInstallation(app, queues))
	);
	queues.push.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processPushJob(app))
	);
	queues.metrics.process(1, commonMiddleware(metricsJob));

	probot.start();
	logger.info(
		`Worker process started with ${CONCURRENT_WORKERS} CONCURRENT WORKERS`
	);
};

export const stop = async (): Promise<void> => {
	await Promise.all([
		queues.discovery.close(),
		queues.installation.close(),
		queues.push.close(),
		queues.metrics.close()
	]);
};
