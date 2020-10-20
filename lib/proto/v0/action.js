/* eslint-disable no-unused-expressions */

/**
 * Enum for Action Proto Types
 *
 * @readonly
 * @enum {string}
 */
const ActionType = {
  CREATED: 'created',
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

module.exports = {
  Action,
  ActionType,
  Association,
  ActionSource,
};
