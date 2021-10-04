import "./config/env"; // Important to be before other dependencies
import throng from "throng";
import * as PrivateKey from "probot/lib/private-key";
import { createProbot } from "probot";
import { initializeSentry } from "./config/sentry";
import "./config/proxy";
import { isNodeProd } from "./util/isNodeEnv";
import configureAndLoadApp from "./configure-robot";
import { listenToMicrosLifecycle } from "./services/micros/lifecycle";

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

/**
 * Start the probot worker.
 */
async function start() {
	initializeSentry();

	// We are always behind a proxy, but we want the source IP
	probot.server.set("trust proxy", true);
	configureAndLoadApp(probot);
	probot.start();
}

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isNodeProd()) {
	// Listen to micros lifecycle event to know when to start/stop
	listenToMicrosLifecycle(() => {
		// Start clustered server
		throng({ lifetime: Infinity }, start);
	}, () => {
		// TODO: add shutdown mechanism here - might need different clustering lib
	});
} else {
	start();
}
