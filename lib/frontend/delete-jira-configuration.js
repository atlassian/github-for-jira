const {
  ActionType,
  ActionSource,
  ActionFromSubscription,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
const { Subscription } = require('../models');
const getJiraClient = require('../jira/client');
const logger = require('../../config/logger');

/**
 * Handle the when a user deletes an entry in the UI
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e;

  try {
    const jiraClient = await getJiraClient(jiraHost, null);
    await jiraClient.devinfo.installation.delete(req.body.installationId);

    /** @type {import('../models/subscription')} */
    const subscription = await Subscription.getSingleInstallation(jiraHost, req.body.installationId);
    const action = ActionFromSubscription(subscription, res.locals.installation);
    action.type = ActionType.DESTROYED;
    action.actionSource = ActionSource.WEB_CONSOLE;

    await subscription.destroy();
    await submitProto(action);

    res.sendStatus(204);
  } catch (err) {
    logger.error(`Error deleting Jira configuration: ${err}`);
  }
};
