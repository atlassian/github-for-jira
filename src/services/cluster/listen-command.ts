import cluster from "cluster";
import { getLogger } from "../../config/logger";
import { ClusterCommand } from "./send-command";

const logger = getLogger("cluster.listen-command");

// Listen on the worker process for messages coming from the master process
// https://nodejs.org/api/cluster.html
export const listenForClusterCommand = (command: ClusterCommand, callback:() => void) => {
	// Only cluster worker process can receive messages
	if (!cluster.isWorker) {
		logger.debug("Only workers can listen for commands, skipping.");
		return;
	}
	// Listen to the `message` event, which is how node master process communicates with workers
	// If message data is he same as the command we are meant to listen for, trigger callback function
	process.on("message", msg => msg === command && callback());
};
