import cluster, { Worker } from "cluster";
import { getLogger } from "../../config/logger";
import { isNodeProd } from "../../util/isNodeEnv";

const logger = getLogger("cluster.send-command");

export enum ClusterCommand {
	start = "cluster-start",
	stop = "cluster-stop"
}

// Sends a command to the worker processes in the node cluster
// https://nodejs.org/api/cluster.html
export const sendCommandToCluster = (command: ClusterCommand) => {
	// Only cluster master process can send commands
	// TODO: change to isPrimary after update to node v16
	if (isNodeProd() && !cluster.isMaster) {
		logger.debug("Cannot send command from worker, skipping.");
		return;
	}
	logger.info(`Sending Micros Lifecycle command '${command}' to worker processes`);
	// Send command to each worker in the cluster
	eachWorker(worker => worker?.send(command));
};

const eachWorker = (callback: (worker?: Worker) => void): void => {
	// Iterate through workers and trigger callback with current worker
	for (const id in cluster.workers) {
		callback(cluster.workers[id]);
	}
};
