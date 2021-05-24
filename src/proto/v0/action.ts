/* eslint-disable no-unused-expressions */

/**
 * Enum for Action Proto Types
 *
 * @readonly
 * @enum {string}
 */
export enum ActionType {
  CREATED = 'created',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  DESTROYED = 'destroyed',
}

/**
 * Enum for Association Types
 *
 * @readonly
 * @enum {string}
 */
export enum Association {
  SUBSCRIPTION = 'subscription',
  INSTALLATION = 'installation',
}

/**
 * Enum for Action Sources
 *
 * @readonly
 * @enum {string}
 */
export enum ActionSource {
  /** An action that came from the Web UI Console in Jira */
  WEB_CONSOLE = 'web_console',

  /** An action from the Stafftools Script */
  STAFFTOOLS = 'stafftools',

  /** An action from a Jira Webhook */
  WEBHOOK = 'webhook',
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
export class Action {
  public type: ActionType;
  public association: Association;
  public installationId: number;
  public githubInstallationId: number;
  public jiraHostname: string;
  public actionSource: ActionSource;
  public githubActorId: number;

  get schema(): string {
    return 'jira.v0.Action';
  }
}

/**
 * Create an action based on info from an installation object
 *
 * @param {import('../../models/installation')} [installation]
 * @returns {Promise<Action>}
 */
export async function ActionFromInstallation(installation):Promise<Action> {
  const action = new Action();
  action.association = Association.INSTALLATION;
  if (installation != null) {
    action.installationId = installation.id;
    action.jiraHostname = installation.jiraHost;
    const subs = await installation.subscriptions();
    if (subs != null && subs.length > 0 && subs[0] != null) {
      action.githubInstallationId = subs[0].gitHubInstallationId;
    }
  }
  return action;
}

/**
 * Create an action based on info from a subscription object
 *
 * @param {import('../../models/subscription')} [subscription]
 * @param {import('../../models/installation')} [installation]
 * @returns {Action}
 */
export function ActionFromSubscription(subscription, installation) {
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
