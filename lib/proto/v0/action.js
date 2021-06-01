/* eslint-disable no-unused-expressions */

/**
 * Enum for Action Proto Types
 *
 * @readonly
 * @enum {string}
 */
 const ActionType = {
  CREATED: 'created',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DESTROYED: 'destroyed',
};

/**
 * Enum for Association Types
 *
 * @readonly
 * @enum {string}
 */
const Association = {
  SUBSCRIPTION: 'subscription',
  INSTALLATION: 'installation',
};

/**
 * Enum for Action Sources
 *
 * @readonly
 * @enum {string}
 */
const ActionSource = {
  /** An action that came from the Web UI Console in Jira */
  WEB_CONSOLE: 'web_console',

  /** An action from the Stafftools Script */
  STAFFTOOLS: 'stafftools',

  /** An action from a Jira Webhook */
  WEBHOOK: 'webhook',
};

/**
 * @typedef BaseProtobuf
 * @property {string} schema
 */

/**
 * Track an action on a subscription/installation
 *
 * Maps to the jira.v0.Action schema in github/hydro-schemas
 *
 * Must be updated manually when the hydro-schemas change.
 *
 * @implements {BaseProtobuf}
 */
class Action {
  constructor() {
    /** @type {ActionType} */
    this.type;

    /** @type {Association} */
    this.association;

    /** @type {?number} */
    this.installationId;

    /** @type {?number} */
    this.githubInstallationId;

    /** @type {?string} */
    this.jiraHostname;

    /** @type {ActionSource} */
    this.actionSource;

    /** @type {?number} */
    this.githubActorId;
  }

  get schema() {
    return 'jira.v0.Action';
  }
}

/**
 * Create an action based on info from an installation object
 *
 * @param {import('../../models/installation')} [installation]
 * @returns {Promise<Action>}
 */
async function ActionFromInstallation(installation) {
  const action = new Action();
  action.association = Association.INSTALLATION;

  try {
    if (installation != null) {
      action.installationId = installation.id;
      action.jiraHostname = installation.jiraHost;
      const subs = await installation.subscriptions();

      if (subs != null && subs.length > 0 && subs[0] != null) {
        action.githubInstallationId = subs[0].gitHubInstallationId;
      }
    }
    return action;
  } catch (err) {
    logger.error(`ActionFromInstallation error: ${err}`);
  }
}

/**
 * Create an action based on info from a subscription object
 *
 * @param {import('../../models/subscription')} [subscription]
 * @param {import('../../models/installation')} [installation]
 * @returns {Action}
 */
function ActionFromSubscription(subscription, installation) {
  const action = new Action();
  action.association = Association.SUBSCRIPTION;

  if (subscription != null) {
    action.githubInstallationId = subscription.gitHubInstallationId;
    action.jiraHostname = subscription.jiraHost;
  }

  if (installation != null) {
    action.installationId = installation.id;
  }

  return action;
}

module.exports = {
  Action,
  ActionFromInstallation,
  ActionFromSubscription,
  ActionType,
  Association,
  ActionSource,
};
