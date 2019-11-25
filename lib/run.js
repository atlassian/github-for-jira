#!/usr/bin/env node

require('dotenv').config();

if (process.env.NEWRELIC_KEY) {
  require('newrelic'); // eslint-disable-line global-require
}

require('../lib/config/sentry').initializeSentry();

const { findPrivateKey } = require('probot/lib/private-key');
const { createProbot } = require('probot');
const app = require('./configure-robot');

const probot = createProbot({
  id: process.env.APP_ID,
  secret: process.env.WEBHOOK_SECRET,
  cert: findPrivateKey(),
  port: process.env.TUNNEL_PORT || process.env.PORT || 3000,
  webhookPath: '/github/events',
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
});

probot.load(app);

probot.start();
