import cluster from "cluster";
import { getLogger } from "config/logger";
import { ClusterCommand } from "./send-command";
import { isNodeProd } from "utils/is-node-env";

const logger = getLogger("cluster.listen-command");

// Listen on the worker process for messages coming from the master process
// https://nodejs.org/api/cluster.html
export const listenForClusterCommand = (command: ClusterCommand, callback: () => void) => {
	// Only cluster worker process can receive messages
	if (isNodeProd() && !cluster.isWorker) {
		logger.debug("Only workers can listen for commands, skipping.");
		return;
	}
	logger.info({ command }, `Listening for command "${command}" on worker "${cluster.worker.id}"`);
	// Listen to the `message` event, which is how node master process communicates with workers
	// If message data is he same as the command we are meant to listen for, trigger callback function
	process.on("message", msg => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		logger.info({ msg, command }, `Received message from master process on worker "${cluster.worker.id}"`);
		if (msg === command) {
			callback();
		}
	});
};
