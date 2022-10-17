import "config/env"; // Important to be before other dependencies
import throng from "throng";
import * as PrivateKey from "probot/lib/private-key";
import { createProbot } from "probot";
import { initializeSentry } from "config/sentry";
import { isNodeProd } from "utils/is-node-env";
import { configureAndLoadApp } from "./configure-robot";

const probot = createProbot({
	id: Number(process.env.APP_ID),
	secret: process.env.WEBHOOK_SECRET,
	cert: PrivateKey.findPrivateKey() || undefined,
	port: Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 8080,
	webhookPath: "/github/events",
	webhookProxy: process.env.WEBHOOK_PROXY_URL,
	throttleOptions: {
		enabled: false
	}
});

async function start() {
	initializeSentry();
	// We are always behind a proxy, but we want the source IP
	probot.server.set("trust proxy", true);
	configureAndLoadApp(probot);
	probot.start();
}

if (isNodeProd()) {
	// Production clustering (one process per core)
	throng({
		worker: start,
		lifetime: Infinity
	});
} else {
	// Dev/test single process, don't need clustering
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	start();
}
