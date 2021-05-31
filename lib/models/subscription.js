const Sequelize = require('sequelize');
const logger = require('../../config/logger');

module.exports = class Subscription extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        gitHubInstallationId: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING,
        selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
        repoSyncState: DataTypes.JSONB,
        syncStatus: DataTypes.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
        syncWarning: DataTypes.STRING,
        jiraClientKey: DataTypes.STRING,
      },
      { sequelize },
    );
  }

  static getAllForHost(host) {
    return Subscription.findAll({
      where: {
        jiraHost: host,
      },
    });
  }

  static getAllForInstallation(installationId) {
    return Subscription.findAll({
      where: {
        gitHubInstallationId: installationId,
      },
    });
  }

  static getAllForClientKey(clientKey) {
    return Subscription.findAll({
      where: {
        jiraClientKey: clientKey,
      },
    });
  }

  static async getSingleInstallation(jiraHost, gitHubInstallationId) {
    return Subscription.findOne({
      where: {
        jiraHost,
        gitHubInstallationId,
      },
    });
  }

  static getInstallationForClientKey(clientKey, installationId) {
    return Subscription.findOne({
      where: {
        jiraClientKey: clientKey,
        gitHubInstallationId: installationId,
      },
    });
  }

  static async install(payload) {
    try {
      const [subscription] = await Subscription.findOrCreate({
        where: {
          gitHubInstallationId: payload.installationId,
          jiraHost: payload.host,
          jiraClientKey: payload.clientKey,
        },
      });

      Subscription.findOrStartSync(subscription);

      return subscription;
    } catch (err) {
      logger.error(`Error installing subscription: ${err}`);
    }
  }

  static uninstall(payload) {
    return Subscription.destroy({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host,
      },
    });
  }

  static async findOrStartSync(subscription, syncType) {
    const { gitHubInstallationId: installationId, jiraHost } = subscription;
    const { queues } = require('../worker');

    const repoSyncState = subscription.get('repoSyncState');

    // If repo sync state is empty
    // start a sync job from scratch
    if (!repoSyncState || (syncType === 'full')) {
      try {
        await subscription.update({
          syncStatus: 'PENDING',
          syncWarning: '',
          repoSyncState: {
            installationId,
            jiraHost,
            repos: {},
          },
        });

        logger.info('Starting Jira sync');
        return queues.discovery.add({ installationId, jiraHost });
      } catch (err) {
        logger.error(`Error finding or starting sync: ${err}`);
      }
    }

    // Otherwise, just add a job to the queue for this installation
    // This will automatically pick back up from where it left off
    // if something got stuck
    return queues.installation.add({ installationId, jiraHost });
  }

  /*
   * Returns array with sync status counts. [ { syncStatus: 'COMPLETED', count: 123 }, ...]
   */
  static async syncStatusCounts() {
    const syncStatusCountQuery = 'SELECT "syncStatus", COUNT(*) FROM "Subscriptions" GROUP BY "syncStatus"';

    try {
      const [results] = await this.sequelize.query(syncStatusCountQuery);

      return results;
    } catch (err) {
      logger.error(`syncStatusCounts error: ${err}`);
    }
  }

  uninstall() {
    return this.destroy();
  }

  resumeSync() {
    return Subscription.findOrStartSync(this);
  }

  restartSync() {
    return Subscription.findOrStartSync(this, 'full');
  }

  // A stalled in progress sync is one that is ACTIVE but has not seen any updates in the last 15 minutes
  // This may happen when an error causes a sync to die without setting the status to 'FAILED'
  isInProgressSyncStalled() {
    if (this.syncStatus === 'ACTIVE') {
      const fifteenMinutesAgo = new Date(new Date() - (15 * 60 * 1000));

      return this.updatedAt < fifteenMinutesAgo;
    } else {
      return false;
    }
  }
};
