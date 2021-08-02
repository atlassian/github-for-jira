const { Probot, createNodeMiddleware } = require('probot');
const express = require('express');
// const { extractBaseURL } = require('./common/helper');
// const { getInstanceMetadata } = require('./common/helper');
const logMiddleware = require('../middleware/log-middleware');
const { Sentry } = require('../config/sentry');
const setupGitHub = require('.');

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
    // TODO: Uncomment this line and the corresponding 'require' statement once the extractBaseURL method has been included in the main branch
    // const githubHost = extractBaseURL(payload).split('/api')[0].split('https://')[1];
    // TODO: Uncomment this line and the corresponding 'require' statement once the getInstanceMetadata method has been included in the main branch
    // const ghaeInstanceData = await getInstanceMetadata(githubHost);
    const probot = new Probot({
      appId: ghaeInstanceData.appId,
      privateKey: ghaeInstanceData.privateKey,
      secret: ghaeInstanceData.webhookSecret,
    });
    const middleware = createNodeMiddleware(setupGitHub, { probot });
    middleware(req, res);
  });
};
