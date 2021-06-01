const {
  ActionType,
  ActionSource,
  ActionFromSubscription,
} = require('../proto/v0/action');
const { submitProto } = require('../tracking');
const { Installation, Subscription } = require('../models');
const logger = require('../../config/logger');

/**
 * Handle the when a user adds a repo to this installation
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  if (!req.session.githubToken) {
    logger.error('No GitHub token');
    res.sendStatus(401);
    return;
  }

  if (!req.body.installationId || !req.body.jiraHost) {
    logger.error('installationId and jiraHost must be provided to delete a subscription.');
    res.status(400);
    res.json({
      err: 'installationId and jiraHost must be provided to delete a subscription.',
    });
    return;
  }

  /**
   * Returns the role of the user for an Org or 'admin' if the
   * installation belongs to the current user
   *
   * @returns {Promise<string>}
   */
  async function getRole({ login, installation }) {
    if (installation.target_type === 'Organization') {
      try {
        const { data: { role } } = await res.locals.github.orgs.getMembership({ org: installation.account.login, username: login });
        return role;
      } catch (err) {
        logger.error(`Error getting membership: ${err}`);
      }
    } else if (installation.target_type === 'User') {
      return (login === installation.account.login) ? 'admin' : '';
    } else {
      logger.error('unknown "target_type" on installationId.');
      throw new Error(`unknown "target_type" on installation id ${req.body.installationId}.`);
    }
  }

  // Check if the user that posted this has access to the installation ID they're requesting
  try {
    const { data: { installations } } = await res.locals.github.apps.listInstallationsForAuthenticatedUser();
    const userInstallation = installations.find(installation => installation.id === Number(req.body.installationId));

    if (!userInstallation) {
      logger.error('User does not have access to that installation to delete subscription.');
      res.status(401);
      res.json({
        err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`,
      });
      return;
    }

    const { data: { login } } = await res.locals.github.users.getAuthenticated();

    // If the installation is an Org, the user needs to be an admin for that Org
    try {
      const role = await getRole({ login, installation: userInstallation });

      if (role !== 'admin') {
        logger.error('User does not have access to that installation to delete subscription.');
        res.status(401);
        res.json({
          err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`,
        });
        return;
      }

      /** @type {import('../models/subscription')} */
      const subscription = await Subscription.getSingleInstallation(req.body.jiraHost, req.body.installationId);
      /** @type {import('../models/installation')} */
      const installation = await Installation.getForHost(req.body.jiraHost);
      const action = ActionFromSubscription(subscription, installation);
      action.type = ActionType.DESTROYED;
      action.actionSource = ActionSource.WEB_CONSOLE;

      await subscription.destroy();
      await submitProto(action);

      logger.info('Successfully deleted subscription.');
      res.sendStatus(202);
    } catch (err) {
      logger.error('Failed to delete subscription.');
      res.status(403);
      res.json({
        err: `Failed to delete subscription to ${req.body.installationId}. ${err}`,
      });
    }
  } catch (err) {
    logger.error(`Delete subscription error: ${err}`);
    res.sendStatus(400);
  }
};
