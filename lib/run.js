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

function printEnvironmentVariables() {
  logger.info(`
    APP_ID=${process.env.APP_ID}
    APP_URL=${process.env.APP_URL}
    ATLASSIAN_URL=${process.env.ATLASSIAN_URL}
    GITHUB_CLIENT_ID=${process.env.GITHUB_CLIENT_ID}
    GITHUB_CLIENT_SECRET=${process.env.GITHUB_CLIENT_SECRET ? `${process.env.GITHUB_CLIENT_SECRET.substr(0, 5)}***` : undefined}
    LOG_LEVEL=${process.env.LOG_LEVEL}
    NODE_ENV=${process.env.NODE_ENV}
    PG_DATABASE_URL=${process.env.PG_DATABASE_URL ? `${process.env.PG_DATABASE_URL.substr(0, 20)}***` : undefined}
    REDIS_BOTTLENECK_HOST=${process.env.REDIS_BOTTLENECK_HOST}
    REDIS_BOTTLENECK_PORT=${process.env.REDIS_BOTTLENECK_PORT}
    TUNNEL_PORT=${process.env.TUNNEL_PORT}
    TUNNEL_SUBDOMAIN=${process.env.TUNNEL_SUBDOMAIN}
    WEBHOOK_SECRET=${process.env.WEBHOOK_SECRET ? `${process.env.WEBHOOK_SECRET.substr(0, 5)}***` : undefined}
  `);
}

logger.info('starting app ...');
printEnvironmentVariables();

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
