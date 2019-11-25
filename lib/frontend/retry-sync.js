const Sentry = require('@sentry/node');
const { Subscription } = require('../models');

module.exports = async (req, res, next) => {
  const { installation } = res.locals;

  const { installationId: gitHubInstallationId, syncType } = req.body;

  Sentry.setExtra('Body', req.body);

  try {
    const subscription = await Subscription.getSingleInstallation(installation.jiraHost, gitHubInstallationId);

    await Subscription.findOrStartSync(subscription, syncType);

    return res.sendStatus(202);
  } catch (error) {
    next(new Error('Unauthorized'));
  }
};
