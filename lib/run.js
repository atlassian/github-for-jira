#!/usr/bin/env node

require('dotenv').config();
const throng = require('throng');

require('newrelic'); // eslint-disable-line global-require
require('./config/sentry').initializeSentry();

const { redisOptions } = require('./config/redis-info')('probot');
const { findPrivateKey } = require('probot/lib/private-key');
const { createProbot } = require('probot');
const app = require('./configure-robot');

const workers = Number(process.env.WEB_CONCURRENCY || 1);

const probot = createProbot({
  id: process.env.APP_ID,
  secret: process.env.WEBHOOK_SECRET,
  cert: findPrivateKey(),
  port: process.env.TUNNEL_PORT || process.env.PORT || 3000,
  webhookPath: '/',
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
  redisConfig: redisOptions,
});

/**
 * Start the probot worker.
 */
function start() {
  // We are always behind a proxy, but we want the source IP
  probot.server.set('trust proxy', true);
  probot.load(app);
  probot.start();
}

if (workers === 1) {
  start();
} else {
  throng({
    workers,
    lifetime: Infinity,
  }, start);
}
