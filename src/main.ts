import "./config/env"; // Important to be before other dependencies
import "newrelic";
import initializeSentry from "./config/sentry";
import throng from "throng";
import getRedisInfo from "./config/redis-info";
import * as PrivateKey from "probot/lib/private-key";
import { createProbot } from "probot";
import App from "./configure-robot";

const { redisOptions } = getRedisInfo("probot");
initializeSentry();

const probot = createProbot({
  id: Number(process.env.APP_ID),
  secret: process.env.WEBHOOK_SECRET,
  cert: PrivateKey.findPrivateKey(),
  port: Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 3000,
  webhookPath: "/github/events",
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
  redisConfig: redisOptions
});

/**
 * Start the probot worker.
 */
function start() {
  // We are always behind a proxy, but we want the source IP
  probot.server.set("trust proxy", true);
  probot.load(App);
  probot.start();
}

// const workers = Number(process.env.WEB_CONCURRENCY) || 1;
const workers = 1;

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (workers > 1) {
  // Start clustered server
  throng({
    workers,
    lifetime: Infinity
  }, start);
} else {
  start();
}

