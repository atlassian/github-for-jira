import "./config/env"; // Important to be before other dependencies
import throng from "throng";
import { isNodeProd } from "utils/is-node-env";
import { listenToMicrosLifecycle } from "./services/micros/lifecycle";
import { ClusterCommand, sendCommandToCluster } from "./services/cluster/send-command";
import { probot } from "./worker/app";
import { initializeSentry } from "./config/sentry";
import { listenForClusterCommand } from "./services/cluster/listen-command";
import { start, stop } from "./worker/startup";

const initialize = () => {
	initializeSentry();
	// starts healthcheck/deepcheck or else deploy will fail
	probot.start();
};

if (isNodeProd()) {
	// Production clustering (one process per core)
	// Read more about Node clustering: https://nodejs.org/api/cluster.html
	throng({
		worker: () => {
			initialize();
			listenForClusterCommand(ClusterCommand.start, start);
			listenForClusterCommand(ClusterCommand.stop, stop);
		},
		master: () => {
			// Listen to micros lifecycle event to know when to start/stop
			listenToMicrosLifecycle(
				// When 'active' event is triggered, start queue processing
				() => sendCommandToCluster(ClusterCommand.start),
				// When 'inactive' event is triggered, stop queue processing
				() => sendCommandToCluster(ClusterCommand.stop)
			);
		},
		lifetime: Infinity
	});
} else {
	initialize();
	// Dev/test single process, no need for clustering or lifecycle events
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	start();
}

