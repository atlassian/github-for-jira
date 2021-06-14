#!/usr/bin/env node
const logger = require('../config/logger');
const { exec } = require('child_process');
const sequelize = require('./models/index');

require('dotenv').config();
const throng = require('throng');

require('newrelic'); // eslint-disable-line global-require
require('./config/sentry').initializeSentry();
const worker = require('./worker');

const { redisOptions } = require('./config/redis-info')('probot');
const { findPrivateKey } = require('probot/lib/private-key');
const { createProbot } = require('probot');
const app = require('./configure-robot');

const probot = createProbot({
  id: process.env.APP_ID,
  secret: process.env.WEBHOOK_SECRET,
  cert: findPrivateKey(),
  port: process.env.TUNNEL_PORT || process.env.PORT || 8080,
  webhookPath: '/github/events',
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
  redisConfig: redisOptions,
});

async function createDBTables() {
  try {
    await new Promise((resolve, reject) => {
      const migrate = exec(
        'node_modules/.bin/sequelize db:migrate',
        { env: process.env },
        err => (err ? reject(err) : resolve()),
      );

      // Forward stdout+stderr to this process
      migrate.stdout.pipe(process.stdout);
      migrate.stderr.pipe(process.stderr);
    });
  } catch (e) {
    logger.error(`Error creating tables: ${e}`);
  }
}

/**
 * Start the probot worker.
 */
async function start() {
  // Create tables for micros environments
  if (process.env.NODE_ENV === 'production') await createDBTables();

  // We are always behind a proxy, but we want the source IP
  probot.server.set('trust proxy', true);
  probot.load(app);
  probot.start();
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
    QUEUE_WORKERS=${process.env.QUEUE_WORKERS}
    WEB_WORKERS=${process.env.WEB_WORKERS}
    WEBHOOK_PROXY_URL=${process.env.WEBHOOK_PROXY_URL}
    GLOBALEDGE_INGRESS_SERVICES_DNS=${process.env.GLOBALEDGE_INGRESS_SERVICES_DNS}
  `);
}

function startWebWorkers() {
  const webWorkers = Number(process.env.WEB_WORKERS || 1);
  if (webWorkers === 1) {
    logger.info('starting single web worker ...');
    start();
    logger.info('single web worker started.');
  } else {
    logger.info(`starting ${webWorkers} web workers ...`);
    throng({
      workers: webWorkers,
      lifetime: Infinity,
    }, start);
    logger.info(`started ${webWorkers} web workers.`);
  }
}

function startQueueWorkers() {
  const queueWorkers = Number(process.env.QUEUE_WORKERS || 1);
  if (queueWorkers === 1) {
    logger.info('starting single queue worker ...');
    worker.start();
    logger.info('single queue worker started.');
  } else {
    logger.info(`starting ${queueWorkers} queue workers ...`);
    throng({
      workers: queueWorkers,
      lifetime: Infinity,
    }, worker.start);
    logger.info(`started ${queueWorkers} queue workers.`);
  }
}

printEnvironmentVariables();
startWebWorkers();
startQueueWorkers();
