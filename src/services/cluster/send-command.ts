import cluster, { Worker } from "cluster";
import { getLogger } from "../../config/logger";

const logger = getLogger("cluster.send-command");

export enum ClusterCommand {
	start = "cluster-start",
	stop = "cluster-stop"
}

export const sendCommandToCluster = (command: ClusterCommand) => {
	if (!cluster.isMaster) {
		logger.debug("Cannot send command from worker, skipping.");
		return;
	}
	logger.info(`Sending Micros Lifecycle command '${command}' to worker processes`);
	eachWorker(worker => worker?.send(command));
};

const eachWorker = (callback: (worker?: Worker) => void): void => {
	for (const id in cluster.workers) {
		callback(cluster.workers[id]);
	}
};
