import { Express } from "express";
import "config/env"; // Important to be before other dependencies
import { getLogger } from "config/logger";
import throng from "throng";
import { initializeSentry } from "config/sentry";
// import { isNodeProd } from "utils/is-node-env";
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
// dead/frozen, the primary node broadcasts "SHUTDOWN" event that make workers to respond with 500 to healthcheck
// requests, which eventually triggers the recycling of the node.
//
const unresponsiveWorkersLogger = getLogger("frontend-app-dead-workers-debug");

const WORKER_STARTUP_TIME_MSEC = 60 * 1000;
const WORKER_NOT_RESPONSIVE_THRESHOLD_MSEC = 60 * 1000;
const SHUTDOWN_MSG = "shutdown";

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
			process.send(`${process.pid}`);
		} else {
			logger.error("process.send is undefined in worker");
			clearInterval(workerPingingServerInterval);
		}
	}, 7000);

	handleErrorsGracefully(logger, [workerPingingServerInterval]);

	process.on("message", (msg) => {
		logger.info(`worker received a message: ${msg}`);
		if (msg === SHUTDOWN_MSG) {
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

	const sendShutdownToAllWorkers = () => {
		logger.info(`send shutdown signal to all workers`);
		for (const worker of Object.values(cluster.workers)) {
			worker?.send(SHUTDOWN_MSG);
		}
	};

	const removeDeadWorkers = () => {
		const keysToKill: Array<string> = [];
		const now = Date.now();
		Object.keys(liveWorkers).forEach((key) => {
			if (now - liveWorkers[key] > WORKER_NOT_RESPONSIVE_THRESHOLD_MSEC) {
				keysToKill.push(key);
			}
		});
		keysToKill.forEach((key) => {
			logger.info(`remove worker with pid=${key} from live workers`);
			delete liveWorkers[key];
		});
	};

	let workersAreReadyAfter: undefined | Date;
	const registerWorkersInterval = setInterval(() => {
		logger.info(`registering workers`);
		// must be invoked periodically to make sure we pick up the respawned workers (if throng does this of course)
		registerNewWorkers();
		if (!workersAreReadyAfter && Object.keys(registeredWorkers).length > nCpus / 2) {
			workersAreReadyAfter = new Date(Date.now() + WORKER_STARTUP_TIME_MSEC);
			logger.info(`consider workers as ready after ${workersAreReadyAfter}`);
		}
	}, 10000);

	const removeDeadInterval = setInterval(() => {
		logger.info(`removing dead workers`);

		if (workersAreReadyAfter && workersAreReadyAfter.getTime() < Date.now()) {
			removeDeadWorkers();
			if (Object.keys(liveWorkers).length < nCpus / 2) {
				logger.info(`half of all the workers are unresponsive`);
				sendShutdownToAllWorkers();
			}
		} else {
			logger.info(`workers are not ready yet, skip`);
		}
	}, 10000);

	handleErrorsGracefully(logger, [registerWorkersInterval, removeDeadInterval]);
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

// if (isNodeProd()) {
// Production clustering (one process per core)
throng({
	master: troubleshootUnresponsiveWorkers_master,
	worker: async () => {
		await start();
		troubleshootUnresponsiveWorkers_worker();
	},
	lifetime: 1
});
// } else {
// 	// Dev/test single process, don't need clustering
// 	// eslint-disable-next-line @typescript-eslint/no-floating-promises
// 	start();
// }

