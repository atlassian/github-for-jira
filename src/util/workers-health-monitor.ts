import { stopHealthcheck } from "utils/healthcheck-stopper";
import Logger from "bunyan";
import cluster from "cluster";
import { exec } from "child_process";
import { logInfoSampled } from "utils/log-sampled";
import glob from "glob";
import fs from "fs";
import AWS from "aws-sdk";
// import nodeOomHeapdump from "node-oom-heapdump";
// import * as fs from "fs";
// import * as path from "path";
// import { envVars } from "config/env";

// const heapdumpsDir = path.join("/tmp", "heapdumps");
//
// if (!fs.existsSync(heapdumpsDir)){
// 	fs.mkdirSync(heapdumpsDir, { recursive: true });
// }

// const generateHeapDumpFilePath = (pid: number) => {
// 	return path.resolve(heapdumpsDir, `heapdump_${envVars.MICROS_INSTANCE_ID}_${pid}`);
// };

// nodeOomHeapdump({
// 	heapdumpOnOOM: true,
//
// 	path: generateHeapDumpFilePath(process.pid)
// });

const CONF_SHUTDOWN_MSG = "shutdown";

export const startMonitorOnWorker = (parentLogger: Logger, iAmAliveInervalMsec: number) => {
	const logger = parentLogger.child({ isWorker: true });
	logger.info({ iAmAliveInervalMsec }, "worker config");

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	logger.info({ memStats: require("v8").getHeapStatistics() });

	process.on("message", (msg: string) => {
		logger.info(`worker received a message: ${msg}`);
		if (msg === CONF_SHUTDOWN_MSG) {
			logger.warn("shutdown received, stop healthcheck");
			stopHealthcheck();
		}
	});

	const workerPingingServerInterval = setInterval(() => {
		if (typeof process.send === "function") {
			logInfoSampled(logger, "startMonitorOnWorker.alive", "sending I'm alive", 100);
			process.send(`${process.pid}`);
		} else {
			logger.error("process.send is undefined in worker, shouldn't happen");
			clearInterval(workerPingingServerInterval);
		}
	}, iAmAliveInervalMsec);
	return workerPingingServerInterval;
};

const logRunningProcesses = (logger: Logger) => {
	exec("ps aux", (err, stdout) => {
		if (err) {
			logger.error({ err }, `exec error: ${err.toString()}`);
			return;
		}

		const outputLines = stdout.split("\n");
		outputLines.forEach((outputLine) => {
			logger.info("running process found: " + outputLine);
		});
	});
};

export const startMonitorOnMaster = (parentLogger: Logger, config: {
	pollIntervalMsecs: number,
	workerStartupTimeMsecs: number,
	workerUnresponsiveThresholdMsecs: number,
	numberOfWorkersThreshold: number,
}) => {
	const logger = parentLogger.child({ isWorker: false });
	logger.info(config, "master config");

	const registeredWorkers: Record<string, boolean> = { }; // pid => true
	const liveWorkers: Record<string, number> = { }; // pid => timestamp

	const registerNewWorkers = () => {
		logInfoSampled(logger, "monRegWorkers", `registering workers`, 100);

		for (const worker of Object.values(cluster.workers)) {
			if (worker) {
				const workerPid = worker.process.pid;
				if (!registeredWorkers[workerPid]) {
					logger.info(`registering a new worker with pid=${workerPid}`);
					registeredWorkers[workerPid] = true;
					worker.on("message", () => {
						logInfoSampled(logger, "workerIsAlive:" + workerPid.toString(), `received message from worker ${workerPid}, marking as live`, 100);
						liveWorkers[workerPid] = Date.now();
					});
					worker.on("exit", (code, signal) => {
						if (signal) {
							logger.warn(`worker was killed by signal: ${signal}, code=${code}`);
						} else if (code !== 0) {
							logger.warn(`worker exited with error code: ${code}`);
						} else {
							logger.warn("worker exited with success code");
						}
					});
				}
			}
		}
	};

	let workersReadyAt: undefined | Date;
	const areWorkersReady = () => workersReadyAt && workersReadyAt.getTime() < Date.now();
	const maybeSetupWorkersReadyAt = () => {
		if (areWorkersReady()) {
			logInfoSampled(logger, "workersReadyNothingToDo", "all workers are considered ready, workersReadyAt", 100);
			return ;
		}

		logRunningProcesses(logger);

		if (!workersReadyAt) {
			if (Object.keys(registeredWorkers).length > config.numberOfWorkersThreshold) {
				workersReadyAt = new Date(Date.now() + config.workerStartupTimeMsecs);
				logger.info(`consider workers as ready after ${workersReadyAt.toString()}`);
			} else {
				logger.info("no enough workers");
			}
		} else {
			logger.info({
				workersReadyAt
			}, `workersReadyAt is defined, idling during ${config.workerStartupTimeMsecs} msecs`);
		}
	};

	const maybeRemoveDeadWorkers = () => {
		if (areWorkersReady()) {
			logger.info(`removing dead workers`);
			const keysToKill: Array<string> = [];
			const now = Date.now();
			Object.keys(liveWorkers).forEach((key) => {
				if (now - liveWorkers[key] > config.workerUnresponsiveThresholdMsecs) {
					keysToKill.push(key);
				}
			});
			keysToKill.forEach((key) => {
				logger.info(`remove worker with pid=${key} from live workers`);
				delete liveWorkers[key];
				logRunningProcesses(logger);
			});
		} else {
			logger.warn("workers are not ready yet, skip removing logic");
		}
	};

	const maybeSendShutdownToAllWorkers = () => {
		const nLiveWorkers = Object.keys(liveWorkers).length;
		if (areWorkersReady() && (nLiveWorkers < config.numberOfWorkersThreshold)) {
			logger.info({
				nLiveWorkers
			}, `send shutdown signal to all workers`);
			for (const worker of Object.values(cluster.workers)) {
				worker?.send(CONF_SHUTDOWN_MSG);
			}
			logRunningProcesses(logger);
		} else {
			logInfoSampled(logger.child({
				areWorkersReady: areWorkersReady(),
				nLiveWorkers
			}), "notSendingSignal", "not sending shutdown signal", 100);
		}
	};

	const maybeUploadCoredumps = () => {
		glob("/tmp/core*.ready", (err: Error, files: Array<string>) => {
			if (err) {
				logger.error("Cannot get files using glob");
				return;
			}
			files.forEach((file) => {
				const inProgressFile =  file + ".inprogress";
				const key = `${file}_${new Date().toISOString().split(":").join("_").split(".").join("_")}`;
				fs.renameSync(file, file + ".inprogress");
				logger.info(`start uploading ${inProgressFile} with key ${key}`);

				const s3 = new AWS.S3();

				const uploadParams = {
					Bucket: process.env.S3_COREDUMPS_BUCKET_NAME!,
					Key: `${process.env.S3_COREDUMPS_BUCKET_PATH}/${key}`,
					Body: fs.createReadStream("file"),
					Region: process.env.S3_COREDUMPS_BUCKET_REGION!
				};

				logger.info({ uploadParams }, "about to upload coredump");

				s3.upload(uploadParams, (err, data) => {
					if (err) {
						logger.error({ err }, `cannot upload ${inProgressFile}`);
					} else {
						logger.info({ data }, `file was successfully uploaded`);
					}
					fs.unlinkSync(inProgressFile);
				});
			});
		});
	};

	return setInterval(() => {
		registerNewWorkers(); // must be called periodically to make sure we pick up new/respawned workers
		maybeSetupWorkersReadyAt();
		maybeRemoveDeadWorkers();
		maybeSendShutdownToAllWorkers();
		maybeUploadCoredumps();
	}, config.pollIntervalMsecs);
};
