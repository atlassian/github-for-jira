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
import cluster from "cluster";
import { cpus } from "os";
import { stopHealthcheck } from "utils/healthcheck-stopper";
import Logger from "bunyan";

//
// "throng" was supposed to restart the dead nodes, but for some reason that doesn't happen for us. The code
// below is to debug this and also to mitigate (while the root cause is unknown): once too many workers are
// dead/frozen, the primary node broadcasts "SHUTDOWN" message that makes workers to respond with 500 to healthcheck
// requests, which eventually triggers the recycling of the node.
//
const unresponsiveWorkersLogger = getLogger("frontend-app-unresponsive-workers-troubleshooting");

const CONF_WORKER_STARTUP_TIME_MSEC = 60 * 1000;
const CONF_WORKER_NOT_RESPONSIVE_THRESHOLD_MSEC = 60 * 1000;
const CONF_SHUTDOWN_MSG = "shutdown";
const CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC = 7000;
const CONF_MASTER_WORKERS_POLL_INTERVAL_MSEC = Math.floor(
	CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC * (2 + Math.random()) // different from KEEP_ALIVE to keep logs separated
);

if (cluster.isMaster) {
	unresponsiveWorkersLogger.info({
		tConfig: {
			CONF_WORKER_STARTUP_TIME_MSEC,
			CONF_WORKER_NOT_RESPONSIVE_THRESHOLD_MSEC,
			CONF_SHUTDOWN_MSG,
			CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC,
			CONF_MASTER_WORKERS_POLL_INTERVAL_MSEC
		}
	}, "troubleshooting config");
}

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
	const logger = unresponsiveWorkersLogger.child({ isWorker: true });
	const workerPingingServerInterval = setInterval(() => {
		if (typeof process.send === "function") {
			logger.info("sending I'm alive");
			process.send(`${process.pid}`);
		} else {
			logger.error("process.send is undefined in worker, shouldn't happen");
			clearInterval(workerPingingServerInterval);
		}
	}, CONF_WORKER_KEEP_ALIVE_PERIOD_MSEC);

	handleErrorsGracefully(logger, [workerPingingServerInterval]);

	process.on("message", (msg) => {
		logger.info(`worker received a message: ${msg}`);
		if (msg === CONF_SHUTDOWN_MSG) {
			logger.warn("shutdown received, stop healthcheck");
			stopHealthcheck();
		}
	});
};

const troubleshootUnresponsiveWorkers_master = () => {
	const logger = unresponsiveWorkersLogger.child({ isWorker: false });

	const registeredWorkers: Record<string, boolean> = { }; // pid => true
	const liveWorkers: Record<string, number> = { }; // pid => timestamp
	const nCpus = cpus().length;
	logger.info(`nCpus=${nCpus}`);

	const registerNewWorkers = () => {
		logger.info(`registering workers`);
		for (const worker of Object.values(cluster.workers)) {
			if (worker) {
				const workerPid = worker.process.pid;
				if (!registeredWorkers[workerPid]) {
					logger.info(`registering a new worker with pid=${workerPid}`);
					registeredWorkers[workerPid] = true;
					worker.on("message", () => {
						logger.info(`received message from worker ${workerPid}, marking as live`);
						liveWorkers[workerPid] = Date.now();
					});
				}
			}
		}
	};

	let workersReadyAt: undefined | Date;
	const areWorkersReady = () => workersReadyAt && workersReadyAt.getTime() < Date.now();
	const maybeSetupWorkersReadyAt = () => {
		if (!workersReadyAt) {
			if (Object.keys(registeredWorkers).length > nCpus / 2) {
				workersReadyAt = new Date(Date.now() + CONF_WORKER_STARTUP_TIME_MSEC);
				logger.info(`consider workers as ready after ${workersReadyAt}`);
			} else {
				logger.info("no enough workers");
			}
		} else {
			logger.info({
				workersReadyAt
			}, "workersReadyAt is defined");
		}
	};

	const maybeRemoveDeadWorkers = () => {
		if (areWorkersReady()) {
			logger.info(`removing dead workers`);
			const keysToKill: Array<string> = [];
			const now = Date.now();
			Object.keys(liveWorkers).forEach((key) => {
				if (now - liveWorkers[key] > CONF_WORKER_NOT_RESPONSIVE_THRESHOLD_MSEC) {
					keysToKill.push(key);
				}
			});
			keysToKill.forEach((key) => {
				logger.info(`remove worker with pid=${key} from live workers`);
				delete liveWorkers[key];
			});
		} else {
			logger.warn("workers are not ready yet, skip removing logic");
		}
	};

	const maybeSendShutdownToAllWorkers = () => {
		const nLiveWorkers = Object.keys(liveWorkers).length;
		if (areWorkersReady() && (nLiveWorkers < nCpus / 2)) {
			logger.info({
				nLiveWorkers
			}, `send shutdown signal to all workers`);
			for (const worker of Object.values(cluster.workers)) {
				worker?.send(CONF_SHUTDOWN_MSG);
			}
		} else {
			logger.info({
				areWorkersReady: areWorkersReady(),
				nLiveWorkers
			}, "not sending shutdown signal");
		}
	};

	const interval = setInterval(() => {
		registerNewWorkers(); // must be called periodically to make sure we pick up new/respawned workers
		maybeSetupWorkersReadyAt();
		maybeRemoveDeadWorkers();
		maybeSendShutdownToAllWorkers();
	}, CONF_MASTER_WORKERS_POLL_INTERVAL_MSEC);

	handleErrorsGracefully(logger, [interval]);
};

const start = async () => {
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
		worker: async () => {
			await start();
			troubleshootUnresponsiveWorkers_worker();
		},
		lifetime: Infinity
	});
} else {
	// Dev/test single process, don't need clustering
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	start();
}

