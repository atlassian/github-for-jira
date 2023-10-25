import { Express } from "express";
import "config/env"; // Important to be before other dependencies
import { getLogger } from "config/logger";
import throng from "throng";
import { initializeSentry } from "config/sentry";
import { isNodeProd } from "utils/is-node-env";
import { getFrontendApp } from "./app";
import createLag from "event-loop-lag";
import { statsd } from "config/statsd";
import { metricLag } from "config/metric-names";
import Logger from "bunyan";
import { startMonitorOnMaster, startMonitorOnWorker } from "utils/workers-health-monitor";
import { cpus } from "os";

//
// "throng" was supposed to restart the dead nodes, but for some reason that doesn't happen for us. The code
// below is to debug this and also to mitigate (while the root cause is unknown): once too many workers are
// dead/frozen, the primary node broadcasts "SHUTDOWN" message that makes workers to respond with 500 to healthcheck
// requests, which eventually triggers the recycling of the node.
//
const unresponsiveWorkersLogger = getLogger("frontend-app-unresponsive-workers-troubleshooting");

const CONF_WORKER_STARTUP_TIME_MSEC = 60 * 1000;
const CONF_WORKER_UNRESPONSIVE_THRESHOLD_MSEC = 60 * 1000;
const CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC = 7000;
const CONF_MASTER_WORKERS_POLL_INTERVAL_MSEC = Math.floor(
	CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC * (2 + Math.random()) // different from KEEP_ALIVE to keep logs separated
);
const CONF_WORKER_DUMP_INTERVAL_MSEC = 10000;
const CONF_WORKER_DUMP_LOW_HEAP_PCT = 25;

const handleErrorsGracefully = (logger: Logger, intervalsToClear: NodeJS.Timeout[]) => {
	process.on("uncaughtExceptionMonitor", (err, origin) => {
		logger.error({ err, origin }, "looks like the process is about to die");
		intervalsToClear.forEach(it => clearInterval(it));
	});

	process.on("unhandledRejection", (err) => {
		logger.error({ err }, "unhandledRejection");
	});

	process.on("SIGTERM", (signal) => {
		logger.error({ signal }, `SIGTERM was received, exit with status 1`);
		intervalsToClear.forEach(it => clearInterval(it));
		process.exit(1);
	});

	process.on("SIGINT", (signal) => {
		logger.error({ signal }, `SIGINT was received, exit with status 1`);
		intervalsToClear.forEach(it => clearInterval(it));
		process.exit(1);
	});
};

const troubleshootUnresponsiveWorkers_worker = () => {
	handleErrorsGracefully(unresponsiveWorkersLogger,
		startMonitorOnWorker(unresponsiveWorkersLogger, {
			iAmAliveInervalMsec: CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC,
			dumpIntervalMsec: CONF_WORKER_DUMP_INTERVAL_MSEC,
			lowHeapAvailPct: CONF_WORKER_DUMP_LOW_HEAP_PCT
		})
	);
};

const troubleshootUnresponsiveWorkers_master = () => {
	handleErrorsGracefully(unresponsiveWorkersLogger,
		[startMonitorOnMaster(unresponsiveWorkersLogger, {
			pollIntervalMsecs: CONF_MASTER_WORKERS_POLL_INTERVAL_MSEC,
			workerStartupTimeMsecs: CONF_WORKER_STARTUP_TIME_MSEC,
			workerUnresponsiveThresholdMsecs: CONF_WORKER_UNRESPONSIVE_THRESHOLD_MSEC,
			numberOfWorkersThreshold: cpus().length / 2
		})]
	);
};

const start = () => {
	initializeSentry();
	const app: Express = getFrontendApp();
	const port = Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 8080;
	app.listen(port, () => {
		getLogger("frontend-app").info(`started at port ${port}`);
	});
	const lag = createLag(1000);
	setInterval(() => {
		statsd.histogram(metricLag.lagHist, lag(), { }, { });
	}, 1000);
};

if (isNodeProd()) {
	// Production clustering (one process per core)
	throng({
		master: troubleshootUnresponsiveWorkers_master,
		worker: () => {
			start();
			troubleshootUnresponsiveWorkers_worker();
		},
		lifetime: Infinity
	}).catch((err: unknown) => {
		getLogger("frontend-app").error({ err }, "Error running frontend-app");
	});
} else {
	// Dev/test single process, don't need clustering
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	start();
}


