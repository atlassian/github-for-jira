import cluster from "cluster";
import { getLogger } from "../../config/logger";
import { ClusterCommand } from "./send-command";

const logger = getLogger("cluster.listen-command");

export const listenForClusterCommand = (command: ClusterCommand, callback:() => void) => {
	if (cluster.isWorker) {
		logger.debug("Only workers can listen for commands, skipping.");
		return;
	}
	process.on("message", msg => msg === command && callback());
};
