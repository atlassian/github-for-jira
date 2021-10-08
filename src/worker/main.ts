import "../config/env"; // Important to be before other dependencies
import "../config/proxy"; // Important to be before other dependencies
import {v4 as uuidv4} from "uuid";
import * as Sentry from "@sentry/node";

import {discovery, DISCOVERY_LOGGER_NAME} from "../sync/discovery";
import {INSTALLATION_LOGGER_NAME, processInstallation} from "../sync/installation";
import {processPushJob, PUSH_LOGGER_NAME} from "../transforms/push";
import metricsJob, {METRICS_LOGGER_NAME} from "./metrics-job";
import statsd from "../config/statsd";
import app, {probot} from "./app";
import AxiosErrorEventDecorator from "../models/axios-error-event-decorator";
import SentryScopeProxy from "../models/sentry-scope-proxy";
import {initializeSentry} from "../config/sentry";
import {getLogger} from "../config/logger";
import {booleanFlag, BooleanFlags} from "../config/feature-flags";
import {RateLimitingError} from "../config/enhance-octokit";
import {queues} from "./queues";
import {queueMetrics} from "../config/metric-names";
import {Job} from "bull";
import {LoggerWithTarget} from "probot/lib/wrap-logger";

const CONCURRENT_WORKERS = process.env.CONCURRENT_WORKERS || 1;
const logger = getLogger("worker.main");

/**
 * Return an async function that assigns a Sentry hub to `job.sentry` and sends exceptions.
 */
const sentryMiddleware = (jobHandler) => async (job, logger: LoggerWithTarget) => {
	job.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
	job.sentry.configureScope((scope) =>
		scope.addEventProcessor(AxiosErrorEventDecorator.decorate)
	);
	job.sentry.configureScope((scope) =>
		scope.addEventProcessor(SentryScopeProxy.processEvent)
	);

	try {
		await jobHandler(job, logger);
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

const logMiddleware = (jobHandler, jobName: string) => {
	return async (job) => {
		const jobLogger = await booleanFlag(BooleanFlags.PROPAGATE_REQUEST_ID, true) ? logger.child({
			name: jobName,
			id: uuidv4() // Probot uses "id" key as "requestId" for tracing; let's use the same key (consistency)
		}) : logger;
		try {
			await jobHandler(job, jobLogger);
		} catch (err) {
			jobLogger.error({err}, "Execution failed!");
		}
	};
}

const setDelayOnRateLimiting = (jobHandler) => async (job: Job, logger: LoggerWithTarget) => {
	try {
		await jobHandler(job, logger);
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

const commonMiddleware = (jobHandler, loggerName: string) => logMiddleware(sentryMiddleware(setDelayOnRateLimiting(jobHandler)), loggerName);

export const start = (): void => {
	initializeSentry();

	// exposing queue metrics at a regular interval
	setInterval(sendQueueMetrics, 60000);

	queues.discovery.process(5, commonMiddleware(discovery(app, queues), DISCOVERY_LOGGER_NAME));
	queues.installation.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processInstallation(app, queues), INSTALLATION_LOGGER_NAME)
	);
	queues.push.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processPushJob(app), PUSH_LOGGER_NAME)
	);
	queues.metrics.process(1, commonMiddleware(metricsJob, METRICS_LOGGER_NAME));

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
