import "../config/env"; // Important to be before other dependencies
import Queue, { QueueOptions } from "bull";
import * as Sentry from "@sentry/node";
import Redis from "ioredis";

import { discovery } from "../sync/discovery";
import { processInstallation } from "../sync/installation";
import { processPush } from "../transforms/push";
import metricsJob from "./metrics-job";
import statsd from "../config/statsd";
import getRedisInfo from "../config/redis-info";
import app, { probot } from "./app";
import AxiosErrorEventDecorator from "../models/axios-error-event-decorator";
import SentryScopeProxy from "../models/sentry-scope-proxy";
import { metricHttpRequest } from "../config/metric-names";
import { initializeSentry } from "../config/sentry";
import { getLogger } from "../config/logger";
import "../config/proxy";
import { EnvironmentEnum } from "../config/env";

const CONCURRENT_WORKERS = process.env.CONCURRENT_WORKERS || 1;
const client = new Redis(getRedisInfo("client").redisOptions);
const subscriber = new Redis(getRedisInfo("subscriber").redisOptions);
const logger = getLogger("worker.main");

function measureElapsedTime(job: Queue.Job, tags) {
	statsd.histogram(metricHttpRequest().jobDuration, job.finishedOn - job.processedOn, tags);
}

const queueOpts: QueueOptions = {
	defaultJobOptions: {
		attempts: 3,
		removeOnComplete: true,
		removeOnFail: true
	},
	redis: getRedisInfo("bull").redisOptions,
	createClient: (type, redisOpts = {}) => {
		let redisInfo;
		switch (type) {
			case "client":
				return client;
			case "subscriber":
				return subscriber;
			default:
				redisInfo = Object.assign({}, redisOpts);
				redisInfo.connectionName = "bclient";
				return new Redis(redisInfo);
		}
	}
};

if (process.env.NODE_ENV === EnvironmentEnum.development) {
	queueOpts.settings = {
		lockDuration: 100000,
		lockRenewTime: 50000 // Interval on which to acquire the job lock
	};
}

// Setup queues
export const queues: { [key: string]: Queue.Queue } = {
	discovery: new Queue("Content discovery", queueOpts),
	installation: new Queue("Initial sync", queueOpts),
	push: new Queue("Push transformation", queueOpts),
	metrics: new Queue("Metrics", queueOpts)
};

// Setup error handling for queues
Object.keys(queues).forEach((name) => {
	const queue = queues[name];
	// On startup, clean any failed jobs older than 10s
	queue.clean(10000, "failed");

	// TODO: need ability to remove these listeners, especially for testing
	queue.on("active", (job: Queue.Job) => {
		logger.info({ job, queue: name }, "Job started");
	});

	queue.on("completed", (job) => {
		logger.info({ job, queue: name }, "Job completed");
		measureElapsedTime(job, { queue: name, status: "completed" });
	});

	queue.on("failed", async (job) => {
		logger.error({ job, queue: name }, "Job failed");
		measureElapsedTime(job, { queue: name, status: "failed" });
	});

	queue.on("error", (err) => {
		logger.error({ queue: name, err }, "Job Errored");

		Sentry.setTag("queue", name);
		Sentry.captureException(err);

		const tags = [`name:${name}`];

		statsd.increment("queue_error", tags);
	});
});

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

const commonMiddleware = (jobHandler) => sentryMiddleware(jobHandler);

export const start = (): void => {
	initializeSentry();

	queues.discovery.process(5, commonMiddleware(discovery(app, queues)));
	queues.installation.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processInstallation(app, queues))
	);
	queues.push.process(
		Number(CONCURRENT_WORKERS),
		commonMiddleware(processPush(app))
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
