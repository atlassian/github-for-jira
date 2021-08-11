const { Probot, createNodeMiddleware } = require('probot');
const express = require('express');
const { AppSecrets } = require('../models');
const logMiddleware = require('../middleware/log-middleware');
const { Sentry } = require('../config/sentry');
const setupGitHub = require('.');
const { getPrivateKey } = require('@probot/get-private-key');
const configConst = require('../config-constants');

/**
 * Create a /github/events endpoint
 *
 */

module.exports = (robot, { getRouter }) => {
  const app = getRouter('/');
  /**
   * /github/events endpoint receive webhooks
   *
   */
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  app.use(express.json());
  app.use(logMiddleware);
  app.use('/github/events', async (req, res, next) => {
    const payload = req.body;
    try {
      const githubHost = (payload && payload.sender && new URL(payload.sender.url).hostname) || '';

      const ghaeInstanceData = await AppSecrets.getForHost(githubHost);
      const probot = new Probot({
        appId: (ghaeInstanceData && ghaeInstanceData.appId) || configConst.DUMMY_APP_ID,
        privateKey: (ghaeInstanceData && ghaeInstanceData.privateKey) || configConst.DUMMY_PRIVATE_KEY,
        secret: (ghaeInstanceData && ghaeInstanceData.webhookSecret) || configConst.DUMMY_WEBHOOK_SECRET,
        baseUrl: (ghaeInstanceData && `https://${githubHost}/api/v3`),
      });
      const middleware = createNodeMiddleware(setupGitHub, { probot });
      middleware(req, res);
    } catch (err) {
      req.log.info({ err });
      return res.sendStatus(500);
    }
  });
};
