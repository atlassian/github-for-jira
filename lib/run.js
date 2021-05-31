#!/usr/bin/env node

require('dotenv').config();
const throng = require('throng');

require('newrelic'); // eslint-disable-line global-require
require('./config/sentry').initializeSentry();

const { redisOptions } = require('./config/redis-info')('probot');
const { findPrivateKey } = require('probot/lib/private-key');
const { createProbot } = require('probot');
const app = require('./configure-robot');
const logger = require('../config/logger');

const workers = Number(process.env.WEB_CONCURRENCY || 1);

const probot = createProbot({
  id: process.env.APP_ID,
  secret: process.env.WEBHOOK_SECRET,
  cert: findPrivateKey(),
  port: process.env.TUNNEL_PORT || process.env.PORT || 3000,
  webhookPath: '/github/events',
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
  redisConfig: redisOptions,
});

/**
 * Start the probot worker.
 */
function start() {
  logger.info('starting Probot app...');
  // We are always behind a proxy, but we want the source IP
  probot.server.set('trust proxy', true);
  logger.info('calling probot.load()...');
  probot.load(app);
  logger.info('calling probot.start()...');
  probot.start();
  logger.info('Probot app started.');
}

logger.info('starting app ...');
if (workers === 1) {
  logger.info('starting single worker ...');
  start();
  logger.info('single worker started.');
} else {
  logger.info(`starting ${workers} workers ...`);
  throng({
    workers,
    lifetime: Infinity,
  }, start);
  logger.info(`started ${workers} workers.`);
}
