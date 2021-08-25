import "./config/env"; // Important to be before other dependencies
import throng from "throng";
import getRedisInfo from "./config/redis-info";
import * as PrivateKey from "probot/lib/private-key";
import { createProbot } from "probot";
import App from "./configure-robot";
import { initializeSentry } from "./config/sentry";
import { getLogger, overrideProbotLoggingMethods } from "./config/logger";
import "./config/proxy";
import { EnvironmentEnum } from "./config/env";

const isProd = process.env.NODE_ENV === EnvironmentEnum.production;
const { redisOptions } = getRedisInfo("probot");

const probot = createProbot({
	id: Number(process.env.APP_ID),
	secret: process.env.WEBHOOK_SECRET,
	cert: PrivateKey.findPrivateKey(),
	port: Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 8080,
	webhookPath: "/github/events",
	webhookProxy: process.env.WEBHOOK_PROXY_URL,
	redisConfig: redisOptions,
});

overrideProbotLoggingMethods(probot.logger);

const logger = getLogger("probot");

/**
 * Start the probot worker.
 */
async function start() {
	initializeSentry();

	// We are always behind a proxy, but we want the source IP
	probot.server.set("trust proxy", true);
	probot.load(App);
	probot.webhook.on("error", (err: Error) => {
		logger.error({...err, err: JSON.stringify(err)}, "Webhook Error")
	});
	probot.start();
}

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isProd) {
	// Start clustered server
	throng(
		{
			lifetime: Infinity
		},
		start
	);
} else {
	start();
}
