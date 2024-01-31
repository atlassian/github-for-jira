import "./config/env"; // Important to be before other dependencies
import throng from "throng";
import { isNodeProd } from "utils/is-node-env";
import { listenToMicrosLifecycle } from "./services/micros/lifecycle";
import { ClusterCommand, sendCommandToCluster } from "./services/cluster/send-command";
import { createWorkerServerApp } from "./worker/app";
import { initializeSentry } from "./config/sentry";
import { listenForClusterCommand } from "./services/cluster/listen-command";
import { start, stop } from "./worker/startup";
import { getLogger } from "config/logger";

const initialize = () => {
	initializeSentry();
	// starts healthcheck/deepcheck or else deploy will fail
	const port = Number(process.env.WORKER_PORT) || Number(process.env.PORT) || 8081;
	const workerWebApp = createWorkerServerApp();
	workerWebApp.listen(port, ()=>{
		getLogger("worker").info(`Worker started at port ${port}`);
	});
};

if (isNodeProd()) {
	// Production clustering (one process per core)
	// Read more about Node clustering: https://nodejs.org/api/cluster.html
	throng({
		worker: () => {
			listenForClusterCommand(ClusterCommand.start, start);
			listenForClusterCommand(ClusterCommand.stop, () => {
				stop().catch((e: unknown) => {
					getLogger("worker").error({ err: e }, "Error stopping worker");
				});
			});
		},
		master: () => {
			initialize();
			// Listen to micros lifecycle event to know when to start/stop
			listenToMicrosLifecycle(
				// When 'active' event is triggered, start queue processing
				() => { sendCommandToCluster(ClusterCommand.start); },
				// When 'inactive' event is triggered, stop queue processing
				() => { sendCommandToCluster(ClusterCommand.stop); }
			);
		},
		lifetime: Infinity
	}).catch((err: unknown) => {
		getLogger("worker").error({ err }, "Error running worker");
	});
} else {
	initialize();
	// Dev/test single process, no need for clustering or lifecycle events
	start();
}

