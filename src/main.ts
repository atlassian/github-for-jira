import "./config/env"; // Important to be before other dependencies
import throng from "throng";
import * as PrivateKey from "probot/lib/private-key";
import { createProbot } from "probot";
import { initializeSentry } from "./config/sentry";
import "./config/proxy";
import { isNodeProd } from "./util/isNodeEnv";
import configureAndLoadApp from "./configure-robot";
import { listenToMicrosLifecycle } from "./services/micros/lifecycle";
import { sendCommandToCluster, ClusterCommand } from "./services/cluster/send-command";
import { listenForClusterCommand } from "./services/cluster/listen-command";
import { getLogger } from "./config/logger";

const logger = getLogger("main");

const probot = createProbot({
	id: Number(process.env.APP_ID),
	secret: process.env.WEBHOOK_SECRET,
	cert: PrivateKey.findPrivateKey() || undefined,
	port: Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 8080,
	webhookPath: "/github/events",
	webhookProxy: process.env.WEBHOOK_PROXY_URL,
	throttleOptions: {
		enabled: false,
	}
});

let running = false;
async function start() {
	if(running) {
		logger.debug("Main instance already running, skipping.");
		return;
	}

	logger.info("Micros Lifecycle: Starting http server");
	// We are always behind a proxy, but we want the source IP
	probot.server.set("trust proxy", true);
	configureAndLoadApp(probot);
	probot.start();
	running = true;
}

async function initialize() {
	initializeSentry();
	listenForClusterCommand(ClusterCommand.start, start);
	listenForClusterCommand(ClusterCommand.stop, stop);
}

// Production clustering (one process per core)
if (isNodeProd()) {
	// Start clustered server
	throng({ lifetime: Infinity }, initialize);
	// Listen to micros lifecycle event to know when to start/stop
	listenToMicrosLifecycle(
		() => sendCommandToCluster(ClusterCommand.start),
		() => sendCommandToCluster(ClusterCommand.stop)
	);
} else {
	// Dev/test single process
	initializeSentry();
	start();
}
