const {
  ActionType,
  ActionSource,
  ActionFromInstallation,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
/** @type {{Installation: import('../models/installation')}} */
const { Installation } = require('../models');
const logger = require('../../config/logger');

/**
 * Handle the install webhook from Jira
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  logger.info('Received installation payload');
  const { baseUrl: host, clientKey, sharedSecret } = req.body;
  const installation = await Installation.install({ host, clientKey, sharedSecret });
  const action = await ActionFromInstallation(installation);
  action.type = ActionType.CREATED;
  action.actionSource = ActionSource.WEBHOOK;
  res.sendStatus(204);

  try {
    await submitProto(action);
  } catch (err) {
    logger.error(`Installation error: ${err}`);
  }
};
